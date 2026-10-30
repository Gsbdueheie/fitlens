import { Alert, Platform } from 'react-native';

/** 跨端删除确认：原生用 Alert，Web 用 window.confirm。 */
export function confirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: '取消', style: 'cancel' },
    { text: '删除', style: 'destructive', onPress: onConfirm },
  ]);
}

/** 跨端提示（非确认）：原生用 Alert，Web 用 window.alert。 */
export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
