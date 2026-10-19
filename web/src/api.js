import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 15000
});

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// token 失效时统一跳回登录页，避免后台"看起来还登录着"但操作全部失败
http.interceptors.response.use(
  (response) => response,
  (error) => {
    // 登录接口自身的 401 是"密码错误"，不能触发刷新
    const isLoginRequest = String(error.config?.url || '').includes('/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      if (window.location.pathname.startsWith('/admin')) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// 登录
export const login = (username, password) => http.post('/login', { username, password });

// 菜单
export const getMenus = () => http.get('/menus');
export const addMenu = (data) => http.post('/menus', data, { headers: authHeaders() });
export const updateMenu = (id, data) => http.put(`/menus/${id}`, data, { headers: authHeaders() });
export const deleteMenu = (id) => http.delete(`/menus/${id}`, { headers: authHeaders() });

// 子菜单
export const getSubMenus = (menuId) => http.get(`/menus/${menuId}/submenus`);
export const addSubMenu = (menuId, data) => http.post(`/menus/${menuId}/submenus`, data, { headers: authHeaders() });
export const updateSubMenu = (id, data) => http.put(`/menus/submenus/${id}`, data, { headers: authHeaders() });
export const deleteSubMenu = (id) => http.delete(`/menus/submenus/${id}`, { headers: authHeaders() });

// 卡片
export const getCards = (menuId, subMenuId = null) =>
  http.get(`/cards/${menuId}`, { params: subMenuId ? { subMenuId } : {} });
export const searchCards = (keyword) => http.get('/cards/search', { params: { q: keyword } });
export const addCard = (data) => http.post('/cards', data, { headers: authHeaders() });
export const updateCard = (id, data) => http.put(`/cards/${id}`, data, { headers: authHeaders() });
export const deleteCard = (id) => http.delete(`/cards/${id}`, { headers: authHeaders() });

// 图标上传
export const uploadLogo = (file) => {
  const formData = new FormData();
  formData.append('logo', file);
  return http.post('/upload', formData, { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } });
};

// 广告
export const getAds = () => http.get('/ads');
export const addAd = (data) => http.post('/ads', data, { headers: authHeaders() });
export const updateAd = (id, data) => http.put(`/ads/${id}`, data, { headers: authHeaders() });
export const deleteAd = (id) => http.delete(`/ads/${id}`, { headers: authHeaders() });

// 友链
export const getFriends = () => http.get('/friends');
export const addFriend = (data) => http.post('/friends', data, { headers: authHeaders() });
export const updateFriend = (id, data) => http.put(`/friends/${id}`, data, { headers: authHeaders() });
export const deleteFriend = (id) => http.delete(`/friends/${id}`, { headers: authHeaders() });

// 用户
export const getUserProfile = () => http.get('/users/profile', { headers: authHeaders() });
export const getMe = () => http.get('/users/me', { headers: authHeaders() });
export const changePassword = (oldPassword, newPassword) =>
  http.put('/users/password', { oldPassword, newPassword }, { headers: authHeaders() });
export const getUsers = () => http.get('/users', { headers: authHeaders() });
