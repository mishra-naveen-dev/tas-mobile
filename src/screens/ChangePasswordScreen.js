import React, { useState, useContext } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { changePassword } from '../api/authApi';
import { AuthContext } from '../context/AuthContext';

const ChangePasswordScreen = ({ navigation }) => {
    const { token } = useContext(AuthContext);

    const [password, setPassword] = useState('');

    const handleChange = async () => {
        try {
            await changePassword(password, token);
            Alert.alert("Success", "Password updated");

            navigation.replace('Login');
        } catch (err) {
            Alert.alert("Error", "Failed");
        }
    };

    return (
        <View style={{ padding: 20 }}>
            <TextInput
                placeholder="New Password"
                secureTextEntry
                onChangeText={setPassword}
                style={{ borderWidth: 1, marginBottom: 10 }}
            />

            <Button title="Update Password" onPress={handleChange} />
        </View>
    );
};

export default ChangePasswordScreen;