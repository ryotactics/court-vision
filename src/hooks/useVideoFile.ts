import { useEffect, useState } from 'react'

export const useVideoFile = (file: File | null) => {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    // Object URLs have to be created in an effect and then stored in state.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!file) {
      setUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  return { url }
}
