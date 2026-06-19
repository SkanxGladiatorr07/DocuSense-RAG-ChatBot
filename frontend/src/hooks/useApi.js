/**
 * @file hooks/useApi.js
 * @description Generic data-fetching hook.
 *              Wraps an async service call with loading / error / data state.
 *
 * Usage:
 *   const { data, loading, error, execute } = useApi(chatService.getHistory)
 *   useEffect(() => { execute() }, [])
 */

import { useState, useCallback } from 'react'

const useApi = (serviceFunction) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const execute = useCallback(
    async (...args) => {
      setLoading(true)
      setError(null)
      try {
        const result = await serviceFunction(...args)
        setData(result)
        return result
      } catch (err) {
        setError(err.message || 'Something went wrong.')
        return null
      } finally {
        setLoading(false)
      }
    },
    [serviceFunction]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return { data, loading, error, execute, reset }
}

export default useApi
