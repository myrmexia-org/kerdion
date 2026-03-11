import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = 'Bearer ' + token
  }
  console.log('Request headers:', config.headers)
  return config
})
export const TOKEN_KEY = 'token'
export { api }
export default api
