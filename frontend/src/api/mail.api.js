import { post } from './client';

export function sendTestMail(to) {
  return post('/mail/test', { to });
}
