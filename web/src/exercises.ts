export type ExerciseGuide = {
  id: string;
  name: string;
  target: string;
  reps: number;
  unit: "reps" | "seconds";
  prescription: string;
  equipment: string;
  images: string[];
  steps: string[];
  easier: string;
  caution: string;
  illustration: string;
  source: string;
  license: string;
};
const image = (name: string) =>
  [1, 2].map((n) => `/exercises/${name}-${n}.png`);
const source = "https://github.com/everkinetic/data";
const license = "https://creativecommons.org/licenses/by-sa/4.0/";
export const EXERCISES: ExerciseGuide[] = [
  {
    id: "squat",
    name: "Squat ke kursi",
    target: "Paha & bokong",
    reps: 12,
    unit: "reps",
    prescription: "2 set × 10–15 repetisi",
    equipment: "Kursi kokoh tanpa roda",
    images: image("squat-to-bench-with-dumbbells"),
    source,
    license,
    illustration:
      "Ilustrasi squat ke bangku dengan dumbbell. Mulai tanpa beban dan gunakan kursi kokoh.",
    steps: [
      "Berdiri di depan kursi, kaki selebar bahu dan telapak menapak penuh.",
      "Dorong pinggul ke belakang, tekuk lutut mengikuti arah jari kaki. Turun perlahan sampai bokong menyentuh kursi.",
      "Dorong lantai melalui seluruh telapak untuk berdiri. Jaga dada dan punggung tetap stabil.",
    ],
    easier: "Gunakan kursi lebih tinggi dan kurangi kedalaman gerakan.",
    caution:
      "Jangan menjatuhkan tubuh ke kursi atau membiarkan lutut masuk ke dalam.",
  },
  {
    id: "pushup",
    name: "Push-up",
    target: "Dada, bahu & trisep",
    reps: 8,
    unit: "reps",
    prescription: "2 set × 6–12 repetisi",
    equipment: "Lantai / dinding / meja kokoh",
    images: image("push-ups"),
    source,
    license,
    illustration:
      "Ilustrasi push-up lantai. Gunakan dinding atau meja kokoh untuk versi lebih ringan.",
    steps: [
      "Letakkan telapak sedikit lebih lebar dari bahu. Luruskan tubuh dari kepala sampai kaki.",
      "Kencangkan perut, tekuk siku sekitar 30–45 derajat dari badan dan turunkan dada perlahan.",
      "Dorong sampai kembali ke posisi awal sambil membuang napas. Jaga pinggul tidak turun.",
    ],
    easier:
      "Mulai dari push-up dinding, lalu meja kokoh, baru lantai ketika sudah nyaman.",
    caution:
      "Pilih permukaan yang tidak bergeser. Berhenti jika pergelangan atau bahu terasa nyeri.",
  },
  {
    id: "row",
    name: "Row dengan tas",
    target: "Punggung & bisep",
    reps: 10,
    unit: "reps",
    prescription: "2 set × 10–12 repetisi per sisi",
    equipment: "Tas tertutup berisi buku / botol",
    images: image("rear-deltoid-row-dumbbell"),
    source,
    license,
    illustration:
      "Ilustrasi row dengan dumbbell. Ganti beban dengan tas yang pegangannya kuat; gunakan beban ringan.",
    steps: [
      "Pegang tas dengan satu tangan, tekuk lutut sedikit dan condongkan badan dari pinggul. Tangan bebas dapat bertumpu di meja kokoh.",
      "Jaga punggung netral dan tarik tas ke arah pinggang dengan siku dekat badan.",
      "Turunkan tas perlahan tanpa memutar badan, lalu ulangi pada sisi lain.",
    ],
    easier: "Kurangi isi tas. Latih gerakan dengan tas kosong terlebih dahulu.",
    caution:
      "Periksa pegangan tas dan tumpuan. Jangan menarik dengan hentakan atau membulatkan punggung.",
  },
  {
    id: "bridge",
    name: "Glute bridge",
    target: "Bokong & paha belakang",
    reps: 12,
    unit: "reps",
    prescription: "2 set × 12–15 repetisi",
    equipment: "Matras / alas yang tidak licin",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/2/2c/Bridge-2.png",
    ],
    source: "https://commons.wikimedia.org/wiki/File:Bridge-2.png",
    license: "https://creativecommons.org/licenses/by-sa/3.0/",
    illustration: "Ilustrasi posisi puncak glute bridge oleh Everkinetic.",
    steps: [
      "Telentang, tekuk lutut dan letakkan kaki selebar pinggul. Tangan di samping badan.",
      "Kencangkan perut dan bokong, dorong melalui tumit sampai bahu, pinggul, dan lutut membentuk garis.",
      "Tahan 1–2 detik, lalu turunkan pinggul perlahan. Tetap bernapas.",
    ],
    easier: "Angkat pinggul lebih rendah dengan gerakan tetap terkontrol.",
    caution:
      "Jangan melengkungkan pinggang berlebihan atau bertumpu pada leher.",
  },
  {
    id: "lunge",
    name: "Split squat berpegangan",
    target: "Paha, bokong & keseimbangan",
    reps: 8,
    unit: "reps",
    prescription: "2 set × 8–10 repetisi per sisi",
    equipment: "Dinding / kursi kokoh untuk berpegangan",
    images: image("dumbbell-lunges"),
    source,
    license,
    illustration:
      "Ilustrasi posisi lunge dengan dumbbell. Untuk split squat, kaki tetap di tempat, tanpa beban, sambil berpegangan.",
    steps: [
      "Berdiri dengan satu kaki di depan dan satu di belakang, selebar pinggul. Pegang tumpuan kokoh.",
      "Tekuk kedua lutut perlahan ke bawah, tumit depan tetap menapak. Badan tetap tegak.",
      "Dorong lewat kaki depan untuk kembali berdiri. Selesaikan repetisi lalu ganti sisi.",
    ],
    easier: "Perpendek rentang turun dan gunakan pegangan untuk keseimbangan.",
    caution:
      "Jangan berdiri seperti di atas satu garis atau memaksakan lutut menyentuh lantai.",
  },
  {
    id: "press",
    name: "Shoulder press botol",
    target: "Bahu & trisep",
    reps: 8,
    unit: "reps",
    prescription: "2 set × 8–12 repetisi",
    equipment: "Dua botol air yang tertutup rapat",
    images: image("dumbbell-shoulder-press"),
    source,
    license,
    illustration:
      "Ilustrasi shoulder press dumbbell. Gunakan botol ringan dengan berat seimbang.",
    steps: [
      "Duduk atau berdiri tegak, perut dikencangkan. Pegang botol di dekat bahu, siku sedikit di depan badan.",
      "Dorong botol perlahan ke atas sejauh nyaman tanpa mengangkat bahu ke telinga.",
      "Turunkan kembali ke bahu secara terkendali sambil tetap bernapas.",
    ],
    easier: "Gunakan botol lebih kecil atau latihan tanpa beban.",
    caution:
      "Hindari melengkungkan pinggang. Hentikan jika bahu terasa terjepit atau nyeri.",
  },
  {
    id: "plank",
    name: "Side plank",
    target: "Perut samping & stabilitas",
    reps: 20,
    unit: "seconds",
    prescription: "2 set × 20–30 detik per sisi",
    equipment: "Matras / alas yang tidak licin",
    images: image("side-plank"),
    source,
    license,
    illustration: "Ilustrasi side plank. Tekuk lutut bawah untuk versi pemula.",
    steps: [
      "Berbaring miring, siku tepat di bawah bahu. Mulai dengan lutut ditekuk jika perlu.",
      "Angkat pinggul sehingga bahu, pinggul, dan lutut/kaki berada dalam satu garis.",
      "Tahan sambil bernapas normal. Turunkan perlahan, lalu ganti sisi.",
    ],
    easier: "Tumpukan pada lutut bawah dan mulai dari tahan 10 detik.",
    caution:
      "Jangan menahan napas atau membiarkan pinggul turun. Durasi dihitung per sisi.",
  },
];
