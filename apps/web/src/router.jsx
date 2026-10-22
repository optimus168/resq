import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const RouterContext = createContext(null);

export function RouterProvider({ children }) {
  const getPath = () => {
    const hash = window.location.hash.replace(/^#/, '');
    return hash ? (hash.startsWith('/') ? hash : '/' + hash) : '/';
  };

  const [pathname, setPathname] = useState(getPath);

  useEffect(() => {
    const onHashChange = () => setPathname(getPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((to, options = {}) => {
    const target = to.startsWith('/') ? to : '/' + to;
    if (options.replace) {
      window.location.replace('#' + target);
    } else {
      window.location.hash = target;
    }
    setPathname(target);
    window.scrollTo(0, 0);
  }, []);

  return (
    <RouterContext.Provider value={{ pathname, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}

export function useNavigate() {
  const { navigate } = useRouter();
  return navigate;
}

export function useLocation() {
  const { pathname } = useRouter();
  return { pathname };
}

export function Link({ to, className = '', children, ...props }) {
  const { navigate } = useRouter();
  const handleClick = (e) => {
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={'#' + to} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}
