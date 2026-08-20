from pydantic import BaseModel, ConfigDict


class PlaceListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_default: bool
    item_count: int
    contains: bool = False  # ?contentid= 쿼리가 있을 때만 의미 있음


class CreateListRequest(BaseModel):
    name: str


class AddItemRequest(BaseModel):
    contentid: int


class ReorderRequest(BaseModel):
    contentids: list[int]  # 원하는 순서 그대로, 리스트에 있는 항목 전체
