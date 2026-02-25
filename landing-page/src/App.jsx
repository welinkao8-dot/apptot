import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, X, Send, Phone, Mail, MapPin } from 'lucide-react';
import './App.css';

// Componente ScrollToTop para garantir que a página começa no topo ao mudar de rota
const ScrollToTop = () => {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const Header = ({ isMenuOpen, setIsMenuOpen }) => {
  const location = useLocation();

  const handleAnchorClick = (e, id) => {
    setIsMenuOpen(false);
    if (location.pathname === '/') {
      e.preventDefault();
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className="header">
      <div className="container">
        <div className="header-inner">
          <Link to="/" className="logo-container" onClick={() => setIsMenuOpen(false)}>
            <img src="/assets/images/logo.png" alt="TOT Logo" className="logo-img" />
          </Link>

          <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          <div className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
            <Link to="/#seguranca" onClick={(e) => handleAnchorClick(e, 'seguranca')}>Segurança</Link>
            <Link to="/#economia" onClick={(e) => handleAnchorClick(e, 'economia')}>Economia</Link>
            <Link to="/#motoristas" onClick={(e) => handleAnchorClick(e, 'motoristas')}>Motoristas</Link>
            <Link to="/suporte" className="support-link" onClick={() => setIsMenuOpen(false)}>Suporte</Link>
            <button className="download-nav-btn">Baixar App</button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="footer-content">
        <div className="footer-links">
          <Link to="/privacy">Política de Privacidade</Link>
          <Link to="/suporte">Suporte</Link>
          <Link to="/terms">Termos de Uso</Link>
        </div>
        <p className="copyright">&copy; 2026 TOT MOTO TÁXI. Todos os direitos reservados.</p>
      </div>
    </div>
  </footer>
);

const Home = () => {
  const location = useLocation();

  React.useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location]);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1>Nunca foi tão <span>seguro e fácil</span> viajar de mota por Luanda.</h1>
            <p className="hero-subtitle">
              <strong>TOT MOTO TÁXI</strong>, vai uma corrida? <br />
              Não se preocupe com preço, a <span>TOT</span> te leva onde precisas com segurança e economia.
            </p>
            <div className="hero-btns">
              <button className="primary-btn">Baixar App Passageiro</button>
              <button className="secondary-btn">Quero ser Motorista</button>
            </div>
          </div>
          <div className="hero-banner-container">
            <img src="/assets/images/banner.jpg" alt="TOT Banner" className="hero-img" />
            <div className="banner-decoration"></div>
          </div>
        </div>
      </section>

      <section className="section motoristas-section" id="motoristas">
        <div className="container split-layout">
          <div className="split-banner">
            <img src="/assets/images/driver_banner.jpg" alt="Driver Banner" className="driver-img" />
          </div>
          <div className="split-content">
            <h2>Trabalhe ao teu ritmo.</h2>
            <p>Seja o seu próprio patrão com a TOT MOTO TÁXI. Oferecemos as melhores ferramentas, segurança e flexibilidade para que possas ganhar dinheiro em Luanda nos teus próprios horários.</p>
            <button className="primary-btn">Seja um Parceiro</button>
          </div>
        </div>
      </section>

      <div className="container section grid-section">
        <div className="grid">
          <div className="card" id="seguranca">
            <h3>Segurança em Primeiro Lugar</h3>
            <p>Motoristas verificados, rastreio em tempo real e monitorização constante. Sua segurança é nossa prioridade absoluta.</p>
          </div>
          <div className="card" id="economia">
            <h3>Economia Garantida</h3>
            <p>Tarifas transparentes e competitivas adaptadas à realidade de Luanda. Viaje mais, pague menos com a TOT.</p>
          </div>
          <div className="card" id="motoristas-card">
            <h3>Seja seu Próprio Patrão</h3>
            <p>Junte-se à nossa equipa de motoristas parceiros e ganhe com flexibilidade total. As melhores vantagens do mercado.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Privacy = () => (
  <div className="privacy-page-wrapper">
    <div className="container">
      <div className="privacy-content">
        <h1>Política de Privacidade</h1>
        <p className="last-update">Última atualização: 24 de Fevereiro de 2026</p>

        <section>
          <h2>1. Informações que Coletamos</h2>
          <p>A TOT coleta informações necessárias para a prestação de serviços de transporte, incluindo:</p>
          <ul>
            <li><strong>Dados de Localização:</strong> Coletamos dados de localização precisa (GPS) para permitir o rastreamento de viagens, cálculo de tarifas e segurança, mesmo quando o aplicativo está em segundo plano.</li>
            <li><strong>Perfil:</strong> Nome, telefone e foto de perfil.</li>
            <li><strong>Viagens:</strong> Histórico de rotas, origem, destino e valores pagos.</li>
          </ul>
        </section>

        <section>
          <h2>2. Uso da Localização em Segundo Plano</h2>
          <p>Para o aplicativo do <strong>Motorista</strong>, a coleta de localização em segundo plano é essencial para:</p>
          <ul>
            <li>Manter o rastreamento da viagem ativo enquanto você usa outros aplicativos ou com a tela desligada.</li>
            <li>Garantir que o passageiro possa ver sua posição em tempo real para sua segurança.</li>
          </ul>
        </section>

        <section>
          <h2>3. Compartilhamento de Dados</h2>
          <p>Não vendemos seus dados. Seus dados de localização são compartilhados apenas com a outra parte da viagem (passageiro/motorista) durante o trajeto.</p>
        </section>

        <section>
          <h2>4. Seus Direitos</h2>
          <p>Você pode revogar as permissões de localização a qualquer momento nas configurações do seu dispositivo, mas isso impedirá o funcionamento principal do aplicativo.</p>
        </section>
      </div>
    </div>
  </div>
);

const Support = () => (
  <div className="support-page-wrapper">
    <div className="container">
      <div className="support-header">
        <h1>Centro de Suporte</h1>
        <p>Estamos aqui para ajudar. Envie-nos a sua dúvida ou problema e a nossa equipa entrará em contacto o mais breve possivel.</p>
      </div>

      <div className="support-grid">
        <div className="support-info">
          <div className="info-item">
            <Phone className="info-icon" />
            <div>
              <h4>Telefone</h4>
              <p>+244 923 897 640</p>
            </div>
          </div>
          <div className="info-item">
            <Mail className="info-icon" />
            <div>
              <h4>Email</h4>
              <p>suporte@taxitot.com</p>
            </div>
          </div>
          <div className="info-item">
            <MapPin className="info-icon" />
            <div>
              <h4>Sede</h4>
              <p>Vila Sede, Junto ao Banco Millenium, Luanda - Angola</p>
            </div>
          </div>
        </div>

        <div className="support-form-container">
          <form className="support-form" onSubmit={(e) => { e.preventDefault(); alert('Mensagem enviada com sucesso!'); }}>
            <div className="form-group">
              <label>Nome Completo</label>
              <input type="text" placeholder="Seu nome" required />
            </div>
            <div className="form-group">
              <label>Email ou Telefone</label>
              <input type="text" placeholder="Como podemos contactar-te?" required />
            </div>
            <div className="form-group">
              <label>Assunto</label>
              <select required>
                <option value="">Selecione um assunto</option>
                <option value="corrida">Problema com Corrida</option>
                <option value="pagamento">Pagamento / Tarifas</option>
                <option value="motorista">Quero ser Motorista</option>
                <option value="outro">Outro assunto</option>
              </select>
            </div>
            <div className="form-group">
              <label>Mensagem</label>
              <textarea rows="5" placeholder="Descreva o seu problema detalhadamente..." required></textarea>
            </div>
            <button type="submit" className="primary-btn submit-btn">
              Enviar Mensagem <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
);

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <Router>
      <ScrollToTop />
      <div className="app-container">
        <Header isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/suporte" element={<Support />} />
            {/* Fallback para Home */}
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
