from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nickname: str
    role: str


class AdminLoginRequest(BaseModel):
    email: str
    password: str
