import api from './api';

export const loginUser = async (username, password) => {
    return api.login(username, password);
};

export const logoutUser = async () => {
    return api.logout();
};

export const changePassword = async (oldPassword, newPassword) => {
    return api.changePassword(oldPassword, newPassword);
};

export default {
    loginUser,
    logoutUser,
    changePassword,
};