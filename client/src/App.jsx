import { useState } from "react";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Register from "./components/Register";
import { Routes, Route } from "react-router";
import Homepage from "./components/Homepage";

function App() {
  // WHY (Code Style): Removed unused API_BASE variable. API calls belong in AuthContext
  // (where they already live), not in App.jsx. Dead variables make the code harder to
  // read and can confuse future developers wondering where this value is used.

  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<Homepage />}></Route>
        <Route path="/login" element={<Login />}></Route>
        <Route path="/register" element={<Register />}></Route>
      </Routes>
    </>
  );
}
export default App;
