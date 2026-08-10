import { goToKakaoLogin, goToGoogleLogin } from "../services/authService"

export default function LoginModal({ open, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-surface-dim/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-[400px] overflow-hidden relative flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface z-10 transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="bg-surface-container-low pt-10 pb-6 flex justify-center items-center">
          <div className="w-16 h-16 bg-surface-container-lowest rounded-full shadow-sm flex items-center justify-center text-primary text-2xl border border-outline-variant/30">
            <span className="material-symbols-outlined">lock</span>
          </div>
        </div>

        <div className="p-8 text-center flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="font-headline-lg-mobile text-xl font-bold text-on-surface">로그인이 필요한 기능이에요</h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              즐겨찾기, 리뷰 작성, 맞춤형 추천 기능을 이용하시려면 로그인이 필요합니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <button
              type="button"
              onClick={goToKakaoLogin}
              className="w-full bg-[#FEE500] hover:bg-[#FDD800] text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined filled-icon text-xl">chat_bubble</span>
              카카오 로그인
            </button>
            <button
              type="button"
              onClick={goToGoogleLogin}
              className="w-full bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-bold py-3 px-4 rounded-lg border border-outline-variant flex items-center justify-center gap-2 transition-colors"
            >
              <GoogleIcon />
              Google 로그인
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-[13px] text-on-surface-variant hover:text-on-surface font-medium transition-colors"
          >
            나중에 하기
          </button>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
