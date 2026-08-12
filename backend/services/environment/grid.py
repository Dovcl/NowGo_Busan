"""위경도 <-> 기상청 단기예보 격자좌표(nx, ny) 변환.

기상청이 배포하는 Lambert Conformal Conic 변환식을 그대로 옮긴 것 — 상수 이름도
원본(기상청 단기예보 조회서비스 활용가이드 첨부 C 코드) 표기를 따른다. 순수 함수라
DB나 외부 API를 전혀 건드리지 않는다.
"""

import math

_RE = 6371.00877  # 지구 반경 (km)
_GRID = 5.0  # 격자 간격 (km)
_SLAT1, _SLAT2 = 30.0, 60.0  # 표준위도
_OLON, _OLAT = 126.0, 38.0  # 기준점 경도·위도
_XO, _YO = 43, 136  # 기준점 격자 X,Y
_DEGRAD = math.pi / 180.0


def latlon_to_grid(lat: float, lon: float) -> tuple[int, int]:
    re = _RE / _GRID
    slat1, slat2 = _SLAT1 * _DEGRAD, _SLAT2 * _DEGRAD
    olon, olat = _OLON * _DEGRAD, _OLAT * _DEGRAD

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = re * sf / math.pow(math.tan(math.pi * 0.25 + olat * 0.5), sn)

    ra = re * sf / math.pow(math.tan(math.pi * 0.25 + lat * _DEGRAD * 0.5), sn)
    theta = lon * _DEGRAD - olon
    if theta > math.pi:
        theta -= 2 * math.pi
    if theta < -math.pi:
        theta += 2 * math.pi
    theta *= sn

    nx = int(ra * math.sin(theta) + _XO + 1.5)
    ny = int(ro - ra * math.cos(theta) + _YO + 1.5)
    return nx, ny
