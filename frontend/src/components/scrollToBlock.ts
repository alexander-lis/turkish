/**
 * Прокрутить к блоку темы, названному в якоре адреса (#block-examples). Без якоря и без
 * такого блока ничего не происходит: содержимое остаётся в начале.
 */
export function scrollToBlock(hash: string): void {
  if (hash !== "") {
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }
}
