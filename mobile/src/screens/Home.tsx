import { StyleSheet, View } from "react-native";
import { Header } from "../components/Header";

export function Home() {
    return (
    <View style={styles.container}>
        <Header />
    </View>
    )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090A',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 64,
  },
});