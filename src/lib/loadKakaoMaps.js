let kakaoLoaderPromise

export function loadKakaoMaps(appKey) {
  if (!appKey) {
    return Promise.reject(new Error('VITE_KAKAO_MAP_APP_KEY is not set'))
  }

  if (window.kakao?.maps) {
    return new Promise((resolve) => {
      window.kakao.maps.load(() => resolve(window.kakao))
    })
  }

  if (kakaoLoaderPromise) {
    return kakaoLoaderPromise
  }

  kakaoLoaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-kakao-maps-sdk]')

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        window.kakao.maps.load(() => resolve(window.kakao))
      })
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Kakao Maps SDK'))
      })
      return
    }

    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.async = true
    script.dataset.kakaoMapsSdk = 'true'
    script.onload = () => {
      window.kakao.maps.load(() => resolve(window.kakao))
    }
    script.onerror = () => reject(new Error('Failed to load Kakao Maps SDK'))
    document.head.appendChild(script)
  })

  return kakaoLoaderPromise
}
