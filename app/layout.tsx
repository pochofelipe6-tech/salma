import './globals.css';
import './login.css';
import './login-racing.css';
import './motion.css';
import './login-reference.css';
export const metadata = { title: 'VÉLO · Seguridad en movimiento', description: 'Monitoreo preventivo de velocidad y gestión de eventos SST.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="es"><body>{children}</body></html> }
