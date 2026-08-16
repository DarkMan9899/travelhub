/**
 * `auth` module public export surface (FRONTEND_ARCHITECTURE.md §6.2) —
 * the ONLY entry point other modules/pages may import from (§6.3).
 */

export { default as LoginForm } from './components/LoginForm/LoginForm.jsx';
export { default as RegisterForm } from './components/RegisterForm/RegisterForm.jsx';
export { default as useLogoutMutation } from './mutations/useLogoutMutation.js';
