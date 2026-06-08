export const labelClass = 'text-[0.72rem] font-medium uppercase tracking-[0.24em] text-zinc-500 transition-colors dark:text-[rgba(250,250,250,0.72)]'
export const textInputClass = 'w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-base text-zinc-950 outline-none transition-colors duration-200 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 dark:border-white/10 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-50/14 dark:hover:border-white/18 dark:focus:border-white/28'
export const secondaryActionClass = 'text-sm font-medium text-zinc-600 underline-offset-4 transition-colors duration-200 hover:text-zinc-950 hover:underline dark:text-zinc-50/80 dark:hover:text-zinc-50'

export function passwordInputClass(hasError) {
  return hasError
    ? 'w-full rounded-2xl border border-red-500/80 bg-white px-5 py-4 text-base text-zinc-950 outline-none placeholder:text-zinc-400 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-50/14'
    : 'w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-base text-zinc-950 outline-none transition-colors duration-200 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 dark:border-white/10 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-50/14 dark:hover:border-white/18 dark:focus:border-white/28'
}
