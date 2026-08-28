# Floating Domain Bar

Zen Browser'ın adres çubuğunu üst kenardan hafifçe ayırır ve boşta dururken tam
URL yerine yalnızca sitenin ana alan adını gösterir.

Örnek:

```text
https://www.youtube.com/watch?v=abc  ->  youtube.com
https://mail.google.com/...          ->  google.com
```

Adres çubuğuna tıklandığında veya `Ctrl+L` kullanıldığında gerçek URL normal
şekilde görünür ve düzenlenebilir. Mod, adres alanının gerçek değerini hiçbir
zaman değiştirmez.

## Gereksinimler

- Zen Browser
- Sine Mod Manager
- Sine ayarlarında, mağaza dışındaki JavaScript modlarını kurmaya izin verilmesi

## Sine ile kurulum

1. Bu klasörü bir GitHub deposuna yükleyin.
2. Zen'de `Ayarlar > Sine Mods` bölümünü açın.
3. Sine ayarlarından mağaza dışı JavaScript modlarına izin verin.
4. Yerel/depo kurulum alanına GitHub depo bağlantısını yapıştırın.
5. Modu kurduktan sonra Zen'i yeniden başlatın.

## Dosyalar

- `userChrome.css`: Yüzen görünüm ve alan adı etiketinin stili.
- `floating-domain-bar.uc.js`: Geçerli sekmenin ana alan adını hesaplar.
- `theme.json`: Sine paket tanımı.

## Uyumluluk

İlk sürüm Windows üzerinde Zen `1.21.16b` / Gecko `154.0.1` yapısına göre
hazırlanmıştır. Farklı toolbar düzenlerinde küçük konum ayarları gerekebilir.
