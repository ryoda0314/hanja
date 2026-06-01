import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import AddWord from "./pages/AddWord";
import WordList from "./pages/WordList";
import HanjaDex from "./pages/HanjaDex";
import HanjaDetail from "./pages/HanjaDetail";
import Combine from "./pages/Combine";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/add" element={<AddWord />} />
        <Route path="/words" element={<WordList />} />
        <Route path="/dex" element={<HanjaDex />} />
        <Route path="/dex/:char" element={<HanjaDetail />} />
        <Route path="/combine" element={<Combine />} />
      </Route>
    </Routes>
  );
}
