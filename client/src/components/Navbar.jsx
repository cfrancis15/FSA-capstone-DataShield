import { Link } from "react-router-dom"
import {useAuth} from '../context/AuthContext'


// Basic top-level navigation for main routes.
export default function Navbar(){

    const {token} = useAuth()

    return(


    <nav className="navbar">
        <Link to='/' className="nav-brand">DataShield</Link>
        <div className="nav-links">
            <Link to='/'>Home</Link>
            <Link to='/login'>Login</Link>
            <Link to='/register'>Register</Link>
            {/* {token && <Link to='/account'>Account</Link>} */}
        </div>
    </nav>
    )
}