import { Alert, Linking, NativeModules, Platform } from 'react-native';
import api from '../api/api';

// Downloads and installs `release` ({ version_code, version_name }). On
// Android the native ApkUpdate module downloads with DownloadManager and
// verifies the file's signature before opening the installer, so a download
// cut short on weak mobile data shows a clear retry message instead of
// Android's "package appears to be invalid". Falls back to the browser when
// the module is missing (iOS, or an older native build).
export async function downloadAndInstall(release) {
    let url;
    try {
        const res = await api.getMobileReleaseDownloadUrl(release.version_code);
        url = res.data?.download_url;
        if (!url) throw new Error('No download link');
    } catch {
        Alert.alert('Update', 'Could not get the update link. Please check your internet and try again.');
        return;
    }

    const native = Platform.OS === 'android' ? NativeModules.ApkUpdate : null;
    if (!native?.downloadAndInstall) {
        await Linking.openURL(url);
        return;
    }

    try {
        await native.downloadAndInstall(
            url,
            `NamraCred TAS ${release.version_name}`,
            `tas-${release.version_name}-${release.version_code}.apk`,
        );
    } catch (e) {
        Alert.alert(
            'Update',
            e?.code === 'CORRUPT'
                ? 'The download was incomplete. Please try again, on Wi-Fi if possible.'
                : 'The update could not be downloaded. Please check your internet and try again.',
        );
    }
}
