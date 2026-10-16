import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Recurring from './pages/Recurring'
import Categories from './pages/Categories'

const router = createBrowserRouter([
  { path: '/', element: <Layout />, children: [
    { index: true, element: <Dashboard /> },
    { path: 'transactions', element: <Transactions /> },
    { path: 'recurring', element: <Recurring /> },
    { path: 'categories', element: <Categories /> },
  ] },
])

export default function App() { return <RouterProvider router={router} /> }
