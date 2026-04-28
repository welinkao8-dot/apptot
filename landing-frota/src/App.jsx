import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, ChevronRight, Shield, Gauge, MapPin, 
  Users, Package, Smartphone, CheckCircle2, 
  Play, Star, ArrowRight, Phone, Mail, Send,
  Activity, Zap, Clock
} from 'lucide-react';
import './App.css';

// --- Components ---

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
};

const Header = ({ isMenuOpen, setIsMenuOpen }) => {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e, id) => {
    e.preventDefault();
    setIsMenuOpen(false);
    
    if (location.pathname !== '/') {
      navigate('/#' + id);
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="container">
        <div className="header-inner">
          <Link to="/" className="logo-container" onClick={() => setIsMenuOpen(false)}>
            <img src="/assets/images/logo.png" alt="TOT Logo" className="logo-img" />
          </Link>

          <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          <div className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
            <a href="#funcionalidades" onClick={(e) => handleNavClick(e, 'funcionalidades')}>Funcionalidades</a>
            <a href="#solucoes" onClick={(e) => handleNavClick(e, 'solucoes')}>Soluções</a>
            <a href="#planos" onClick={(e) => handleNavClick(e, 'planos')}>Planos</a>
            <Link to="/suporte" className="support-link" onClick={() => setIsMenuOpen(false)}>Suporte</Link>
            <button className="btn-primary">Testar Grátis</button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="footer-grid">
        <div className="footer-brand">
          <Link to="/" className="logo-container">
            <img src="/assets/images/logo.png" alt="TOT Logo" className="logo-img" />
          </Link>
          <p>O sistema de gestão de frotas mais moderno de Angola. Segurança, controle e eficiência na palma da sua mão.</p>
        </div>
        <div className="footer-col">
          <h5>Plataforma</h5>
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#solucoes">Soluções</a>
          <a href="#planos">Planos</a>
          <a href="#">Dashboard</a>
        </div>
        <div className="footer-col">
          <h5>Suporte</h5>
          <Link to="/suporte">Centro de Ajuda</Link>
          <Link to="/privacy">Privacidade</Link>
          <a href="#">Termos de Uso</a>
          <a href="#">Contato</a>
        </div>
        <div className="footer-col">
          <h5>Escritório</h5>
          <p style={{marginBottom: '0.5rem'}}>Vila Sede, Luanda</p>
          <p>+244 923 897 640</p>
          <p>suporte@taxitot.com</p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2026 TOT FROTA. Todos os direitos reservados.</p>
        <div className="footer-made">
          Feito em Angola com <span>❤</span>
        </div>
      </div>
    </div>
  </footer>
);

// --- Pages ---

const Home = () => {
  const location = useLocation();

  useEffect(() => {
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
    <div className="home-content">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div className="hero-text">
              <div className="hero-badge">
                <span></span> EM DIRETO DE ANGOLA
              </div>
              <h1>Controle Total da sua <span>Frota em Tempo Real</span>.</h1>
              <p className="hero-subtitle">
                A plataforma inteligente para empresas e famílias. Rastreie veículos, monitore equipamentos e proteja quem mais ama com tecnologia de ponta.
              </p>
              <div className="hero-btns">
                <button className="btn-primary">Começar Agora <ChevronRight size={18} /></button>
                <button className="btn-outline"><Play size={18} fill="currentColor" /> Ver Demo</button>
              </div>
              <div className="hero-stats">
                <div>
                  <div className="hero-stat-num">2.5k<span>+</span></div>
                  <div className="hero-stat-label">Veículos Ativos</div>
                </div>
                <div>
                  <div className="hero-stat-num">99<span>%</span></div>
                  <div className="hero-stat-label">Precisão GPS</div>
                </div>
                <div>
                  <div className="hero-stat-num">24<span>/7</span></div>
                  <div className="hero-stat-label">Suporte Local</div>
                </div>
              </div>
            </div>
            <div className="hero-img-wrap">
              <img src="/assets/images/hero_fleet.png" alt="Dashboard Tot Frota" />
              <div className="hero-img-badge">
                <div className="hero-img-badge-dot"></div>
                <div>
                  <strong>Camião T-450</strong>
                  <p>Luanda, Via Expressa • 65 km/h</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos Section */}
      <section className="logos-bar">
        <div className="container">
          <div className="logos-bar-inner">
            <p>CONFIADO POR EMPRESAS LÍDERES</p>
            <div className="logos-list">
              <span>LOGISTICA X</span>
              <span>ANGOLA TRANS</span>
              <span>CONSTRUTORA SUL</span>
              <span>MINERAÇÃO TOT</span>
              <span>PESCA VIVA</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section" id="funcionalidades">
        <div className="container">
          <div style={{textAlign: 'center', marginBottom: '4rem'}}>
            <span className="section-label">PORQUÊ A TOT FROTA?</span>
            <h2 className="section-title">Tudo o que precisa para <span>gestão total</span>.</h2>
            <p className="section-desc" style={{margin: '0 auto'}}>Uma solução completa projetada para os desafios das estradas e negócios em Angola.</p>
          </div>
          
          <div className="features-grid">
            <div className="feat-card glass-card">
              <div className="feat-icon"><MapPin size={24} /></div>
              <h3>Rastreamento em Tempo Real</h3>
              <p>Saiba exatamente onde estão os seus veículos e equipamentos a cada segundo, com mapas detalhados de Angola.</p>
            </div>
            <div className="feat-card glass-card">
              <div className="feat-icon"><Gauge size={24} /></div>
              <h3>Controle de Combustível</h3>
              <p>Evite desperdícios e roubos com relatórios precisos de consumo e alertas de reabastecimento inesperado.</p>
            </div>
            <div className="feat-card glass-card">
              <div className="feat-icon"><Shield size={24} /></div>
              <h3>Segurança Avançada</h3>
              <p>Bloqueio remoto do motor, alertas de excesso de velocidade e botão de pânico para emergências.</p>
            </div>
            <div className="feat-card glass-card">
              <div className="feat-icon"><Users size={24} /></div>
              <h3>Comportamento do Motorista</h3>
              <p>Monitore travagens bruscas, acelerações agressivas e tempo de inatividade para melhorar a condução.</p>
            </div>
            <div className="feat-card glass-card">
              <div className="feat-icon"><Activity size={24} /></div>
              <h3>Manutenção Preventiva</h3>
              <p>Receba alertas automáticos para trocas de óleo, pneus e revisões baseados na quilometragem real.</p>
            </div>
            <div className="feat-card glass-card">
              <div className="feat-icon"><Zap size={24} /></div>
              <h3>Relatórios Inteligentes</h3>
              <p>Analise a performance da sua operação com dados exportáveis em PDF e Excel de forma simples.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="section usecases" id="solucoes">
        <div className="container">
          <div style={{marginBottom: '4rem'}}>
            <span className="section-label">SOLUÇÕES PARA TODOS</span>
            <h2 className="section-title">Uma ferramenta, <span>infinitas possibilidades</span>.</h2>
          </div>

          <div className="usecases-grid">
            <div className="usecase-card glass-card">
              <img src="/assets/images/company_manager.png" alt="Empresas" className="usecase-img" />
              <span className="usecase-tag">CORPORATIVO</span>
              <h3>Gestão de Frotas Empresariais</h3>
              <p>Otimize rotas, reduza custos operacionais em até 30% e tenha visibilidade total da sua logística.</p>
              <ul className="usecase-list">
                <li>Logística e Distribuição</li>
                <li>Frotas de Vendas</li>
                <li>Veículos de Construção</li>
              </ul>
            </div>
            <div className="usecase-card glass-card">
              <img src="/assets/images/driver_tracking.png" alt="Indivíduos" className="usecase-img" />
              <span className="usecase-tag">INDIVIDUAL</span>
              <h3>Proteção Particular</h3>
              <p>Rastreie o seu carro ou mota pessoal e tenha a tranquilidade de saber onde o seu património está.</p>
              <ul className="usecase-list">
                <li>Recuperação em caso de Roubo</li>
                <li>Histórico de Trajetos</li>
                <li>Alertas de Ignição</li>
              </ul>
            </div>
            <div className="usecase-card glass-card">
              <img src="/assets/images/parent_tracking.png" alt="Família" className="usecase-img" />
              <span className="usecase-tag">FAMILIAR</span>
              <h3>Segurança para Pais</h3>
              <p>Saiba quando os seus filhos chegam à escola ou regressam a casa com notificações automáticas.</p>
              <ul className="usecase-list">
                <li>Localização em Tempo Real</li>
                <li>Cercas Geográficas Virtuais</li>
                <li>Velocidade de Condução</li>
              </ul>
            </div>
            <div className="usecase-card glass-card">
              <div className="usecase-img" style={{background: 'var(--navy-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                 <Package size={80} color="var(--primary)" />
              </div>
              <span className="usecase-tag">EQUIPAMENTOS</span>
              <h3>Rastreio de Ativos</h3>
              <p>Não perca de vista geradores, contentores ou máquinas de alto valor em estaleiros ou remotamente.</p>
              <ul className="usecase-list">
                <li>Sensores de Movimento</li>
                <li>Bateria de Longa Duração</li>
                <li>Resistente a poeira e água</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Split CTA */}
      <section className="section">
        <div className="container">
          <div className="split-layout">
            <div className="split-text">
              <h2>Tudo na <span>palma da sua mão</span>.</h2>
              <p>O nosso aplicativo móvel permite que gira tudo a partir de qualquer lugar. Simples, rápido e intuitivo.</p>
              <ul className="check-list">
                <li><div className="check-icon"><CheckCircle2 size={14} /></div> Notificações push em tempo real</li>
                <li><div className="check-icon"><CheckCircle2 size={14} /></div> Mapas offline otimizados</li>
                <li><div className="check-icon"><CheckCircle2 size={14} /></div> Gestão de múltiplos dispositivos</li>
              </ul>
              <button className="btn-primary">Baixar App <ChevronRight size={18} /></button>
            </div>
            <div className="split-img">
              <img src="/assets/images/driver_tracking.png" alt="App Preview" />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="section" id="planos">
        <div className="container">
          <div style={{textAlign: 'center', marginBottom: '4rem'}}>
            <span className="section-label">PREÇOS TRANSPARENTES</span>
            <h2 className="section-title">Escolha o plano ideal para <span>si</span>.</h2>
          </div>

          <div className="plans-grid">
            <div className="plan-card glass-card">
              <div className="plan-name">Básico</div>
              <div className="plan-price"><sup>Kz</sup> 8.500<span>/mês</span></div>
              <p className="plan-desc">Ideal para rastreio individual de veículos.</p>
              <ul className="plan-features">
                <li><CheckCircle2 size={16} /> Rastreio 24/7</li>
                <li><CheckCircle2 size={16} /> App Mobile</li>
                <li><CheckCircle2 size={16} /> Alertas de Ignição</li>
                <li style={{opacity: 0.5}}><X size={16} /> Relatórios de Combustível</li>
              </ul>
              <button className="btn-outline" style={{width: '100%'}}>Selecionar</button>
            </div>
            <div className="plan-card glass-card featured">
              <div className="plan-popular">Mais Popular</div>
              <div className="plan-name">Profissional</div>
              <div className="plan-price"><sup>Kz</sup> 15.000<span>/mês</span></div>
              <p className="plan-desc">Perfeito para pequenas e médias empresas.</p>
              <ul className="plan-features">
                <li><CheckCircle2 size={16} /> Tudo do Básico</li>
                <li><CheckCircle2 size={16} /> Controle de Combustível</li>
                <li><CheckCircle2 size={16} /> Histórico de 90 dias</li>
                <li><CheckCircle2 size={16} /> Relatórios em PDF</li>
              </ul>
              <button className="btn-primary" style={{width: '100%'}}>Selecionar</button>
            </div>
            <div className="plan-card glass-card">
              <div className="plan-name">Empresarial</div>
              <div className="plan-price">Sob<span>Consulta</span></div>
              <p className="plan-desc">Para grandes frotas e necessidades especiais.</p>
              <ul className="plan-features">
                <li><CheckCircle2 size={16} /> Tudo do Profissional</li>
                <li><CheckCircle2 size={16} /> API de Integração</li>
                <li><CheckCircle2 size={16} /> Gestor de Conta Dedicado</li>
                <li><CheckCircle2 size={16} /> Instalação ao Domicílio</li>
              </ul>
              <button className="btn-outline" style={{width: '100%'}}>Contactar</button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <h2>Pronto para assumir o controle?</h2>
          <p>Junte-se a centenas de angolanos que já confiam na TOT FROTA para proteger os seus bens e otimizar os seus negócios.</p>
          <div className="cta-btns">
            <button className="btn-primary">Criar Conta Grátis</button>
            <button className="btn-outline">Falar com Consultor</button>
          </div>
        </div>
      </section>
    </div>
  );
};

const Privacy = () => (
  <div className="privacy-page container">
    <div className="privacy-content">
      <h1>Política de Privacidade</h1>
      <p className="updated">Última atualização: 28 de Abril de 2026</p>
      
      <section>
        <h2>1. Coleta de Dados</h2>
        <p>A TOT FROTA coleta dados de localização GPS em tempo real para fornecer serviços de rastreamento. Estes dados são encriptados e armazenados de forma segura.</p>
      </section>
      
      <section>
        <h2>2. Uso da Informação</h2>
        <p>A localização é utilizada exclusivamente para os fins contratados pelo utilizador: monitorização de frotas, segurança pessoal ou familiar.</p>
      </section>
      
      <section>
        <h2>3. Partilha de Dados</h2>
        <p>Não partilhamos dados de localização com terceiros para fins publicitários. Os dados só são acedidos pelas autoridades em caso de solicitação judicial ou emergência confirmada pelo utilizador.</p>
      </section>
    </div>
  </div>
);

const Support = () => (
  <div className="support-page container">
    <div className="support-head">
      <h1>Centro de Suporte</h1>
      <p>Nossa equipe técnica em Luanda está pronta para ajudar.</p>
    </div>
    
    <div className="support-layout">
      <div className="info-cards">
        <div className="info-card glass-card">
          <div className="info-icon-wrap"><Phone size={20} /></div>
          <div>
            <h4>Telefone</h4>
            <p>+244 923 897 640</p>
          </div>
        </div>
        <div className="info-card glass-card">
          <div className="info-icon-wrap"><Mail size={20} /></div>
          <div>
            <h4>Email</h4>
            <p>suporte@taxitot.com</p>
          </div>
        </div>
        <div className="info-card glass-card">
          <div className="info-icon-wrap"><MapPin size={20} /></div>
          <div>
            <h4>Sede</h4>
            <p>Vila Sede, Luanda - Angola</p>
          </div>
        </div>
      </div>
      
      <div className="form-wrap">
        <h3>Envie uma Mensagem</h3>
        <p>Responderemos em menos de 2 horas.</p>
        <form onSubmit={(e) => { e.preventDefault(); alert('Mensagem enviada!'); }}>
          <div className="form-row">
            <div className="form-group">
              <label>Nome</label>
              <input type="text" placeholder="Seu nome" required />
            </div>
            <div className="form-group">
              <label>Telefone</label>
              <input type="text" placeholder="9xx xxx xxx" required />
            </div>
          </div>
          <div className="form-group">
            <label>Assunto</label>
            <select required>
              <option value="">Selecione um tema</option>
              <option value="vendas">Vendas e Orçamentos</option>
              <option value="tecnico">Suporte Técnico</option>
              <option value="financeiro">Financeiro</option>
            </select>
          </div>
          <div className="form-group">
            <label>Mensagem</label>
            <textarea rows="4" placeholder="Como podemos ajudar?"></textarea>
          </div>
          <button type="submit" className="btn-primary form-submit">Enviar <Send size={18} /></button>
        </form>
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
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
