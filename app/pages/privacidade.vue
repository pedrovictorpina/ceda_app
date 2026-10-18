<script setup lang="ts">
definePageMeta({ layout: 'institutional' })
useSeoMeta({ title: 'Privacidade e seus dados' })
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-14">
    <UBadge
      color="warning"
      variant="subtle"
      label="Informações em revisão institucional"
    /><h1 class="mt-4 text-4xl font-black">
      Privacidade e seus dados
    </h1>
    <p class="mt-4 leading-7 text-muted">
      Aqui explicamos quais informações as funções atuais do aplicativo utilizam e quais escolhas você pode fazer.
      Esta descrição funcional ainda depende de validação institucional e não representa uma política aprovada juridicamente.
    </p>
    <UAlert
      class="mt-6"
      color="warning"
      variant="subtle"
      title="Informações que ainda precisam ser confirmadas"
      description="A identificação do responsável pelo tratamento, os prazos de guarda e o canal específico para assuntos de privacidade ainda precisam ser definidos pela igreja. Para esclarecer uma dúvida agora, consulte os canais oficiais em Contato."
    />
    <UButton
      to="/contato"
      class="mt-4"
      color="neutral"
      variant="outline"
      label="Consultar os contatos oficiais"
      icon="i-lucide-messages-square"
    />

    <div class="mt-8 space-y-8 leading-7">
      <section aria-labelledby="privacy-account">
        <h2
          id="privacy-account"
          class="text-xl font-bold"
        >
          Cadastro e perfil
        </h2>
        <p class="mt-3 text-muted">
          Nome, e-mail e senha permitem criar sua conta e entrar. Telefone e data de nascimento são opcionais no cadastro;
          no perfil você também pode informar sexo e escolher uma foto. Esses dados apoiam a identificação, os contatos e as preferências da sua conta.
          A equipe com permissão de gestão pode consultar os cadastros para administrar o aplicativo.
        </p>
        <p class="mt-3 text-muted">
          Você pode consultar os horários, as informações da igreja e os canais oficiais sem criar uma conta.
          A autenticação e os registros das funções do aplicativo usam o Supabase.
        </p>
      </section>

      <section aria-labelledby="privacy-sharing">
        <h2
          id="privacy-sharing"
          class="text-xl font-bold"
        >
          Você escolhe o que compartilhar
        </h2>
        <ul class="mt-3 list-disc space-y-3 pl-5 text-muted">
          <li><strong class="text-default">Aniversariantes:</strong> aparecer nessa área é uma escolha opcional em Perfil, em “Quero receber felicitações”. Quando ativada, membros veem nome, foto e dia e mês do aniversário; o ano e a idade não aparecem nessa lista. Você pode desativar a preferência no perfil.</li>
          <li><strong class="text-default">Oração:</strong> cada novo pedido começa com “Somente eu”. Você pode escolher “Equipe pastoral” para disponibilizá-lo também à equipe autorizada ou “Comunidade” para permitir acesso de outros membros. Confira a escolha antes de salvar e inclua apenas o que deseja compartilhar com esse público.</li>
          <li><strong class="text-default">Conversas da comunidade:</strong> publicações, curtidas e comentários ficam associados à sua conta e são compartilhados com as pessoas que têm acesso à conversa.</li>
          <li><strong class="text-default">Células e grupos:</strong> solicitações e participações são utilizadas pela liderança para acompanhar seu interesse. Ao solicitar uma visita a uma célula, você escolhe se deseja compartilhar seu telefone com a liderança.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-family">
        <h2
          id="privacy-family"
          class="text-xl font-bold"
        >
          Família e Sementinhas
        </h2>
        <p class="mt-3 text-muted">
          A lista de familiares do perfil guarda nome, parentesco e nascimento para acompanhar os aniversários da sua casa.
          Esse cadastro pessoal é diferente do cadastro de crianças no Sementinhas.
        </p>
        <p class="mt-3 text-muted">
          No Sementinhas, nome e nascimento identificam a criança e ajudam a indicar sua faixa etária.
          Foto e informações de alergia são opcionais. Responsáveis vinculados, professores e administração autorizada acessam os dados necessários ao acompanhamento das crianças.
          Entradas, saídas e chamados aos responsáveis também ficam registrados para acompanhar o atendimento.
        </p>
      </section>

      <section aria-labelledby="privacy-activity">
        <h2
          id="privacy-activity"
          class="text-xl font-bold"
        >
          Pedidos, conteúdos salvos e avisos
        </h2>
        <p class="mt-3 text-muted">
          Pedidos da loja, solicitações de participação e preferências de lembrete ficam associados à sua conta para que você e a equipe autorizada acompanhem essas tarefas.
          Conteúdos salvos ficam disponíveis na sua área de Salvos.
        </p>
        <p class="mt-3 text-muted">
          Os avisos são consultados dentro do aplicativo. Em Perfil, você pode escolher se deseja receber novos avisos internos;
          desativar essa preferência não apaga os avisos já recebidos. O aplicativo não promete alertas externos de push.
        </p>
      </section>

      <section aria-labelledby="privacy-session">
        <h2
          id="privacy-session"
          class="text-xl font-bold"
        >
          Acesso neste dispositivo
        </h2>
        <p class="mt-3 text-muted">
          “Lembrar meu acesso” mantém a sessão neste dispositivo. No navegador, desmarcar essa opção limita a sessão à aba;
          no aplicativo, a sessão lembrada utiliza as preferências do dispositivo. O aplicativo guarda informações de sessão, sem armazenar a senha digitada.
          Em um aparelho compartilhado, use “Sair” ao terminar.
        </p>
        <p class="mt-3 text-muted">
          O carrinho em preparação também pode ficar salvo nesta aba, vinculado à sua conta, para você continuar ao voltar à loja.
          Textos de oração em andamento são mantidos apenas na tela enquanto você escreve; só são registrados quando o envio é confirmado.
        </p>
        <p class="mt-3 text-muted">
          A recuperação de senha utiliza um link por e-mail e uma verificação vinculada ao navegador em que você iniciou o pedido.
          Se não conseguir abrir esse link no mesmo navegador, peça outro a partir dele.
        </p>
      </section>

      <section aria-labelledby="privacy-choices">
        <h2
          id="privacy-choices"
          class="text-xl font-bold"
        >
          Correção e pedido de exclusão
        </h2>
        <p class="mt-3 text-muted">
          Você pode atualizar seus dados e preferências em Perfil. Nessa mesma página, “Solicitar exclusão da conta”
          registra um pedido para análise administrativa após sua confirmação. Essa ação não apaga automaticamente a conta nem os registros;
          o aplicativo não informa um prazo de conclusão.
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <UButton
            to="/perfil"
            label="Abrir meu perfil"
            icon="i-lucide-user-round"
          />
          <UButton
            to="/contato"
            color="neutral"
            variant="outline"
            label="Tirar uma dúvida sobre meus dados"
            icon="i-lucide-message-circle"
          />
        </div>
      </section>
    </div>
  </article>
</template>
