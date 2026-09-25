Páginas de la carta para `/carta`, sacadas de `public/carta-horno-san-lorenzo.pdf`.
Si cambia el PDF, se regeneran así (borrando antes las viejas):

    rm src/assets/carta/pagina-*.jpg
    pdftoppm -jpeg -jpegopt quality=85 -scale-to-x 1200 -scale-to-y -1 \
      public/carta-horno-san-lorenzo.pdf src/assets/carta/pagina
