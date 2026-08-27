import { get, post } from './client';

export function login(email, password, remember) {
  return post('/auth/login', { email, password, remember });
}

export function getMe() {
  return get('/auth/me');
}

export function logout() {
  return post('/auth/logout');
}
