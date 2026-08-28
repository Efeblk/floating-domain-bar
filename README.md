# Floating Domain Bar

Zen Browser'ın normal üst araç çubuğu için ayırdığı satırı kaldırır, adres
çubuğunu sayfanın üzerinde yüzdürür ve yerleşik gezinme düğmelerini yanına
toplar. Boşta dururken tam URL yerine yalnızca sitenin ana alan adını gösterir.
Bar, sidebar açık veya kapalıyken web alanının merkezinde kalır ve Zen'in
`Ctrl+S` ile açılan Compact Mode durumunda gizlenmez.

Zen Split View açıldığında tek ortak çubuk yerine görünür her sekme panelinin
üzerinde ayrı bir adres/arama çubuğu oluşur (Zen'in desteklediği en fazla dört
panel). Çubuklar panel ölçülerini doğrudan izlediği için yatay, dikey ve ızgara
yerleşimlerinde; bölme oranı veya pencere boyutu değiştiğinde kendi alanlarına
göre yeniden ortalanıp daralır. Dar panellerde gezinme düğmeleri otomatik
gizlenerek yazı alanına öncelik verilir.

Örnek:

```text
https://www.youtube.com/watch?v=abc  ->  youtube.com
https://mail.google.com/...          ->  google.com
```

Adres çubuğuna tıklandığında veya `Ctrl+L` kullanıldığında gerçek URL normal
şekilde görünür ve düzenlenebilir. Mod, adres alanının gerçek değerini hiçbir
zaman değiştirmez.

Split View'da bir panelin çubuğuna tıklamak o paneli etkinleştirir. Yazılan
adres veya arama Enter ile yalnız o panele yüklenir; `Ctrl+L` de etkin
panelin çubuğuna odaklanır.

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
