import "./styles/global.css";

import { Habit } from "./components/Habit";

function App() {
    return (
        <div className="App">
            <Habit completed={2} />
            <Habit completed={4} />
            <Habit completed={2} />
            <Habit completed={2} />
            <Habit completed={2} />
            <Habit completed={2} />
        </div>
    );
}

export default App;
