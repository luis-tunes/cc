import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const EFFECTIVE_DATE = "28 de março de 2026";
const COMPANY = "xTIM";
const DOMAIN = "xtim.ai";
const CONTACT_EMAIL = "privacidade@xtim.ai";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-6 py-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>
          <div className="flex items-center gap-2 text-tim-gold">
            <Shield className="h-5 w-5" />
            <span className="font-semibold text-sm">{COMPANY}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Política de Privacidade
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          Última atualização: {EFFECTIVE_DATE}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-700">
          {/* 1 */}
          <Section title="1. Responsável pelo tratamento">
            <p>
              O responsável pelo tratamento dos dados pessoais recolhidos
              através de <strong>{DOMAIN}</strong> é a entidade que opera a
              plataforma {COMPANY} (adiante &ldquo;nós&rdquo;), contactável
              através de{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-tim-gold hover:text-amber-600">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          {/* 2 */}
          <Section title="2. Dados que recolhemos">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Dados de conta</strong> — nome, endereço de e-mail e
                identificador de autenticação, fornecidos pelo serviço Clerk
                aquando do registo.
              </li>
              <li>
                <strong>Dados de faturação</strong> — processados pela Stripe;
                não armazenamos números de cartão de crédito nos nossos
                servidores.
              </li>
              <li>
                <strong>Documentos carregados</strong> — faturas e outros
                documentos que o utilizador submete para processamento OCR e
                classificação.
              </li>
              <li>
                <strong>Dados de utilização</strong> — endereço IP, tipo de
                navegador e páginas visitadas, para fins de segurança e melhoria
                do serviço.
              </li>
            </ul>
          </Section>

          {/* 3 */}
          <Section title="3. Finalidades e base legal">
            <p>Tratamos os seus dados para:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Execução do contrato de prestação do serviço (art.&nbsp;6.º,
                n.º&nbsp;1, al.&nbsp;b) do RGPD).
              </li>
              <li>
                Cumprimento de obrigações legais, nomeadamente fiscais e
                contabilísticas (art.&nbsp;6.º, n.º&nbsp;1, al.&nbsp;c) do
                RGPD).
              </li>
              <li>
                Interesse legítimo na melhoria do serviço e prevenção de fraude
                (art.&nbsp;6.º, n.º&nbsp;1, al.&nbsp;f) do RGPD).
              </li>
            </ul>
          </Section>

          {/* 4 */}
          <Section title="4. Partilha de dados">
            <p>
              Os dados podem ser partilhados com os seguintes subcontratantes,
              estritamente no âmbito da prestação do serviço:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Clerk</strong> — autenticação e gestão de utilizadores.
              </li>
              <li>
                <strong>Stripe</strong> — processamento de pagamentos.
              </li>
              <li>
                <strong>Sentry</strong> — monitorização de erros (opcional,
                apenas metadados técnicos).
              </li>
            </ul>
            <p className="mt-2">
              Não vendemos nem cedemos dados pessoais a terceiros para fins de
              marketing.
            </p>
          </Section>

          {/* 5 */}
          <Section title="5. Transferências internacionais">
            <p>
              Alguns subcontratantes podem tratar dados fora do Espaço Económico
              Europeu (EEE). Nesses casos, asseguramos que existem garantias
              adequadas, nomeadamente Cláusulas Contratuais-Tipo aprovadas pela
              Comissão Europeia.
            </p>
          </Section>

          {/* 6 */}
          <Section title="6. Conservação dos dados">
            <p>
              Os dados são conservados enquanto a conta estiver ativa e durante o
              período legalmente exigido após o encerramento (nomeadamente
              obrigações fiscais — até 10 anos, nos termos do Código do IRC e da
              LGT).
            </p>
          </Section>

          {/* 7 */}
          <Section title="7. Os seus direitos">
            <p>
              Nos termos do RGPD e da legislação portuguesa (Lei n.º&nbsp;58/2019),
              tem direito a:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Aceder aos seus dados pessoais.</li>
              <li>Retificar dados inexatos ou incompletos.</li>
              <li>Solicitar o apagamento dos dados (&ldquo;direito ao esquecimento&rdquo;).</li>
              <li>Limitar ou opor-se ao tratamento.</li>
              <li>Portabilidade dos dados.</li>
              <li>
                Apresentar reclamação junto da{" "}
                <strong>
                  Comissão Nacional de Proteção de Dados (CNPD)
                </strong>{" "}
                — <span className="break-all">www.cnpd.pt</span>.
              </li>
            </ul>
            <p className="mt-2">
              Para exercer qualquer destes direitos, contacte-nos através de{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-tim-gold hover:text-amber-600">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          {/* 8 */}
          <Section title="8. Segurança">
            <p>
              Adotamos medidas técnicas e organizativas adequadas para proteger
              os dados pessoais, incluindo encriptação em trânsito (TLS),
              controlo de acesso, monitorização e cópias de segurança regulares.
            </p>
          </Section>

          {/* 9 */}
          <Section title="9. Cookies">
            <p>
              Utilizamos apenas cookies estritamente necessários ao
              funcionamento da plataforma (autenticação e preferências de
              sessão). Não utilizamos cookies de rastreamento ou de publicidade.
            </p>
          </Section>

          {/* 10 */}
          <Section title="10. Alterações a esta política">
            <p>
              Podemos atualizar esta política periodicamente. As alterações
              significativas serão comunicadas através da plataforma ou por
              e-mail. A data de última atualização no topo deste documento será
              sempre atualizada.
            </p>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-xs text-gray-400 text-center">
          © {new Date().getFullYear()} {COMPANY}. Todos os direitos reservados.
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}
