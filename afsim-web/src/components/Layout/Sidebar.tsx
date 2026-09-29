interface SidebarProps {
  side: 'left' | 'right';
  open: boolean;
  children: React.ReactNode;
}

export function Sidebar({ side, open, children }: SidebarProps) {
  return (
    <aside className={`sidebar sidebar-${side} ${open ? 'open' : 'closed'}`}>
      <div className="sidebar-content">{children}</div>
    </aside>
  );
}
