<template>
  <div class="min-h-screen bg-default text-default">
    <header class="sticky top-0 z-40 border-b border-default bg-default/95 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <NuxtLink
          to="/"
          class="focus-ring flex items-center gap-2 rounded-md font-semibold"
        ><span class="grid size-9 place-items-center rounded-xl bg-primary font-black text-white">C</span>CEDA</NuxtLink>
        <div class="flex items-center gap-2">
          <UColorModeButton /><UButton
            to="/entrar"
            label="Entrar"
          />
        </div>
      </div>
    </header>
    <main><slot /></main>
  </div>
</template>
