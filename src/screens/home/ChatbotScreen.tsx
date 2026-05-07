import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MessageCircleMore } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';

const ChatbotScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <MessageCircleMore size={42} color={Colors.primary} />
        <Text style={styles.title}>Tư vấn chatbot</Text>
        <Text style={styles.description}>
          Màn hình này đã có điều hướng sẵn. Phần nội dung tư vấn sẽ làm ở bước tiếp theo.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F2',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 18,
  },
  description: {
    color: Colors.gray,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ChatbotScreen;
