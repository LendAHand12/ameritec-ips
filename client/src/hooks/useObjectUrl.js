import { useEffect, useState } from 'react'

/** Preview URL for a File/Blob, revoked automatically when the file changes or the component unmounts. */
export function useObjectUrl(file) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!file) return setUrl(null)
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return url
}
