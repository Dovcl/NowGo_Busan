from sqlalchemy.orm import declarative_base

# 모든 ORM 모델(Place 등)이 상속받는 공통 베이스.
# session.py, models.py가 이걸 각자 import해서 쓰기 때문에 순환 import를 피하려고 따로 뺐음.
Base = declarative_base()
