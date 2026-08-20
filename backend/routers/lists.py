from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import PlaceList, PlaceListItem, User
from db.session import get_db
from routers.auth import get_current_user
from schemas.lists import AddItemRequest, CreateListRequest, PlaceListOut, ReorderRequest

router = APIRouter(prefix="/lists", tags=["Lists"])


def _ensure_default_list(db: Session, user: User) -> None:
    """구글 지도의 "즐겨찾기" 리스트처럼, 유저마다 기본 리스트 하나를 보장한다.
    회원가입 시점이 아니라 리스트를 처음 조회할 때 지연 생성한다."""
    exists = (
        db.query(PlaceList.id)
        .filter(PlaceList.user_id == user.id, PlaceList.is_default.is_(True))
        .first()
    )
    if exists is None:
        db.add(PlaceList(user_id=user.id, name="즐겨찾기", is_default=True))
        db.commit()


def _owned_list(db: Session, user: User, list_id: int) -> PlaceList:
    place_list = db.query(PlaceList).filter(PlaceList.id == list_id, PlaceList.user_id == user.id).first()
    if place_list is None:
        raise HTTPException(status_code=404, detail="리스트를 찾을 수 없습니다")
    return place_list


@router.get("", response_model=list[PlaceListOut])
def list_my_lists(
    contentid: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_default_list(db, user)

    rows = (
        db.query(
            PlaceList.id,
            PlaceList.name,
            PlaceList.is_default,
            func.count(PlaceListItem.contentid).label("item_count"),
        )
        .outerjoin(PlaceListItem, PlaceListItem.list_id == PlaceList.id)
        .filter(PlaceList.user_id == user.id)
        .group_by(PlaceList.id)
        .order_by(PlaceList.is_default.desc(), PlaceList.created_at)
        .all()
    )

    contains_list_ids = set()
    if contentid is not None:
        contains_list_ids = {
            row.list_id
            for row in db.query(PlaceListItem.list_id)
            .join(PlaceList, PlaceList.id == PlaceListItem.list_id)
            .filter(PlaceList.user_id == user.id, PlaceListItem.contentid == contentid)
            .all()
        }

    return [
        PlaceListOut(
            id=row.id,
            name=row.name,
            is_default=row.is_default,
            item_count=row.item_count,
            contains=row.id in contains_list_ids,
        )
        for row in rows
    ]


@router.get("/{list_id}/items", response_model=list[int])
def list_items(list_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned_list(db, user, list_id)
    rows = (
        db.query(PlaceListItem.contentid)
        .filter(PlaceListItem.list_id == list_id)
        .order_by(PlaceListItem.position)
        .all()
    )
    return [row.contentid for row in rows]


@router.put("/{list_id}/items/order", status_code=204)
def reorder_items(list_id: int, body: ReorderRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """드래그로 재배열한 결과를 통째로 반영. body.contentids는 원하는 순서 그대로."""
    _owned_list(db, user, list_id)
    items = {
        item.contentid: item
        for item in db.query(PlaceListItem).filter(PlaceListItem.list_id == list_id).all()
    }
    if set(body.contentids) != set(items.keys()):
        raise HTTPException(status_code=400, detail="리스트의 장소 구성과 일치하지 않습니다")
    for position, contentid in enumerate(body.contentids):
        items[contentid].position = position
    db.commit()


@router.post("", response_model=PlaceListOut)
def create_list(body: CreateListRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    place_list = PlaceList(user_id=user.id, name=body.name)
    db.add(place_list)
    db.commit()
    db.refresh(place_list)
    return PlaceListOut(id=place_list.id, name=place_list.name, is_default=False, item_count=0, contains=False)


@router.post("/{list_id}/items", status_code=204)
def add_item(list_id: int, body: AddItemRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned_list(db, user, list_id)
    exists = db.query(PlaceListItem).filter_by(list_id=list_id, contentid=body.contentid).first()
    if exists is None:
        max_position = db.query(func.max(PlaceListItem.position)).filter(PlaceListItem.list_id == list_id).scalar()
        next_position = 0 if max_position is None else max_position + 1
        db.add(PlaceListItem(list_id=list_id, contentid=body.contentid, position=next_position))
        db.commit()


@router.delete("/{list_id}/items/{contentid}", status_code=204)
def remove_item(list_id: int, contentid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned_list(db, user, list_id)
    db.query(PlaceListItem).filter_by(list_id=list_id, contentid=contentid).delete()
    db.commit()
