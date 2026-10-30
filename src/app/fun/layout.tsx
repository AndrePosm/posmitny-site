import './fun.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function FunLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fun-page">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
