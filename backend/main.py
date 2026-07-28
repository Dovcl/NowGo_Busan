from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import api_router
from core.config import settings

# [설정 로딩 흐름]
# .env (실제 값) -> core/config.py의 Settings(BaseSettings)가 pydantic-settings로 자동 로딩
#               -> settings = Settings() 싱글턴 인스턴스 하나 생성
#               -> main.py를 포함 어디서든 from core.config import settings 로 재사용
# 예전에는 os.getenv()를 main.py 안에서 직접 호출했는데, 그러면 설정값을 쓰는 파일마다
# os.getenv 호출이 흩어지고 기본값/타입 검증도 파일마다 따로 해야 했음.
# 지금은 config.py 한 곳에서만 환경변수를 정의하고, 나머지는 settings.XXX로 읽기만 함.


# [요청/응답 흐름]
# react에서 요청을 보내 -> fetch("http://localhost:8080/") = 브라우저 -> http:localhost:8080으로 get 요청
# 그럼 fastapi에 도착하면 가장먼저 Middleware를 지남. fastapi 내부에서 요청 -> CORSMIDDLEWARE -> 라우터(@app.get) -> 함수실행
# 여기서 allow_origins=settings.FRONTEND_ORIGINS 이므로, 그 목록에 있는 origin에서 온 요청만 허용! 판단
# MIDDLEWARE 통과하면 라우터 실행
# 그러면 {"message": "Nowgo Busan 서버가 실행 중입니다."} 반환 -> 응답
# 응답도 middleware를 지나 브라우저로 감 응답 = root() -> Response 생성 -> CORSMIDDLEWARE -> 브라우저
# 여기서 Middleware는 응답헤더에 Access-Control-Allow-Origin: 같은 CORS 헤더 붙여줌
# = 아 이 서버가 settings.FRONTEND_ORIGINS 안에 있는 곳에서 오는 요청을 허용했구나~ 하고 react에게 응답을 넘겨줌


# FastAPI 앱 객체 생성
# title, description, version은 이제 하드코딩이 아니라 config.py의 settings에서 가져옴
# (/docs 페이지에 표시되는 값들도 여기서 나옴 -> 앱 메타데이터의 진실 소스는 config.py 하나뿐)
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
)


# CORS 설정: settings.FRONTEND_ORIGINS에 등록된 프론트엔드 주소의 요청만 허용한다
# React와 FastAPI가 서로 통신하려고 middleware가 있는거임.
# 최종적으로 frontend 요청 -> middleware -> fastapi 라우트(@app.get) -> middleware -> frontend
# 요리 비유: 다른 건물(프론트엔드)에서 오는 배달 요청을 허용하는 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
# api_router는 routers/__init__.py에서 health 등 하위 라우터들을 미리 묶어놓은 것.
# main.py는 이 묶음 하나만 등록하면 되고, 나중에 places/score 라우터가 늘어나도
# 여기(main.py)는 더 이상 안 건드리고 routers/__init__.py만 수정하면 됨.
app.include_router(api_router)

# 엔드포인트 라우트
# url에 get 요청이 오면 root()가 실행되도록 경로 하나를 등록한 것.
@app.get("/")
def root():
    return {"message": "Nowgo Busan 서버가 실행 중입니다."}
    