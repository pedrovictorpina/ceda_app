<template>
  <div class="min-h-screen bg-default text-default">
    <header class="sticky top-0 z-40 border-b border-default bg-default/95 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <BrandLogo />
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
