import React, { useState } from 'react';
import './App.css';

function App() {
  const [showPrivacy, setShowPrivacy] = useState(false);

  if (showPrivacy) {
    return (
      <div className="privacy-page">
        <nav className="header">
          <div className="logo">TOT MOTO TÁXI</div>
          <button onClick={() => setShowPrivacy(false)}>Voltar</button>
        </nav>
        <div className="privacy-content">
          <h1>Política de Privacidade</h1>
          <p>Última atualização: 24 de Fevereiro de 2026</p>

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
        <footer className="footer">
          <p>&copy; 2026 TOT MOTO TÁXI. Todos os direitos reservados.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="landing">
      <nav className="header">
        <div className="container">
          <div className="logo-container">
            <img src="/assets/images/logo.png" alt="TOT Logo" className="logo-img" />
          </div>
          <div className="nav-links">
            <a href="#seguranca">Segurança</a>
            <a href="#economia">Economia</a>
            <a href="#motoristas">Motoristas</a>
            <button className="download-nav-btn">Baixar App</button>
          </div>
        </div>
      </nav>

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

      <div className="container section">
        <div className="grid">
          <div className="card" id="seguranca">
            <h3>Segurança em Primeiro Lugar</h3>
            <p>Motoristas verificados, rastreio em tempo real e monitorização constante. Sua segurança é nossa prioridade absoluta.</p>
          </div>
          <div className="card" id="economia">
            <h3>Economia Garantida</h3>
            <p>Tarifas transparentes e competitivas adaptadas à realidade de Luanda. Viaje mais, pague menos com a TOT.</p>
          </div>
          <div className="card" id="motoristas">
            <h3>Seja seu Próprio Patrão</h3>
            <p>Junte-se à nossa equipa de motoristas parceiros e ganhe com flexibilidade total. As melhores vantagens do mercado.</p>
          </div>
        </div>
      </div>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-links">
              <a href="#" onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }}>Política de Privacidade</a>
              <a href="#">Termos de Uso</a>
              <a href="#">Contacto</a>
            </div>
            <p className="copyright">&copy; 2026 TOT MOTO TÁXI. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
