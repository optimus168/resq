import React from 'react';
import { useNavigate as useAppNavigate, useLocation as useAppLocation } from '../router';

export const useNavigate = useAppNavigate;
export const useLocation = useAppLocation;

export function useParams() {
  const { pathname } = useAppLocation();
  // Match /station/:stationId or /geoshield/station/:stationId
  const match = pathname.match(/\/station\/([^/?#]+)/);
  if (match) {
    return { stationId: match[1], id: match[1] };
  }
  return {};
}

export function NavLink({ to, end, className, children, onClick, ...props }) {
  const { pathname } = useAppLocation();
  const navigate = useAppNavigate();
  const isActive = end ? pathname === to : pathname.startsWith(to);
  const resolvedClass = typeof className === 'function' ? className({ isActive }) : className;
  return (
    <a
      href={'#' + to}
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick(e);
        navigate(to);
      }}
      className={resolvedClass}
      {...props}
    >
      {children}
    </a>
  );
}

export function Link({ to, className, children, onClick, ...props }) {
  const navigate = useAppNavigate();
  return (
    <a
      href={'#' + to}
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick(e);
        navigate(to);
      }}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}

export function HashRouter({ children }) {
  return <>{children}</>;
}

export function BrowserRouter({ children }) {
  return <>{children}</>;
}

export function Routes({ children }) {
  const { pathname } = useAppLocation();
  let matched = null;
  React.Children.forEach(children, (child) => {
    if (!matched && React.isValidElement(child)) {
      const path = child.props.path;
      if (path === pathname || (path !== '/' && pathname.startsWith(path))) {
        matched = child.props.element;
      } else if (path === '/' && (pathname === '/' || pathname === '')) {
        matched = child.props.element;
      }
    }
  });
  return matched;
}

export function Route({ element }) {
  return element;
}

export default {
  useNavigate,
  useLocation,
  useParams,
  NavLink,
  Link,
  HashRouter,
  BrowserRouter,
  Routes,
  Route
};
