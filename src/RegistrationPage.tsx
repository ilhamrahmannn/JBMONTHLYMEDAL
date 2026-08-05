import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import {
  CheckCircle2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  QrCode,
  Upload,
  X,
} from "lucide-react";
import { db, storage } from "./firebase";

const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toUpperCase();

const compressReceiptImage = async (file: File) => {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The receipt image could not be read."));
      element.src = objectUrl;
    });
    const maxDimension = 1800;
    const scale = Math.min(
      1,
      maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");

    if (!context) return file;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );

    if (!blob || blob.size >= file.size) return file;

    const compressedName = file.name.replace(/\.[^.]+$/, "") + "-compressed.jpg";
    return new File([blob], compressedName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const steps = [
  "Personal",
  "Category & Level",
  "Attendance & Payment",
  "Review",
];

const ntrpLevels = [
  "Below 2.0",
  "2.0 – 2.5",
  "3.0 – 3.5",
  "3.5 – 4.0",
  "Above 4.0",
];

const shirtSizes = ["S", "M", "L", "XL", "2XL", "Others"];
const CATEGORY_LIMIT = 24;
const OFFICIAL_RANKING_NAMES = [
  "KHALIS",
  "AKID KHALISH",
  "ABD FADZIL",
  "MOHD ASIL IQBAL BIN RAMLI",
  "AIRIL RAZIQUE B ASMADI",
  "ARIFF SAFWAN",
  "CHUA YI ZERN",
  "NORRUL AZMI BI. YAHYA",
  "AWIE",
  "MUHAMMAD ARYAN DANIYAL B NORRUL AZMI",
  "MUAMMAR GADDAFI BIN A. LATIP",
  "GAN ZHENG HUI",
  "KENNETH KOW",
  "SIOW YIH CHANG",
  "TAN HANG MING",
  "PATRICK TEOW",
  "CHUA PEI KERN",
  "KOH YEE SOON",
  "WAN NUR QASEEH",
  "ZICO OOI JYH GAU",
  "MOHAMMAD AZIM BIN MOHD ALIP",
  "GOH PING KUEN",
  "WONG JUN XUAN",
  "ADAM",
  "LIM CHEE SOON",
  "NG TECK SIM",
  "TAY YEE YING",
  "CHEN WANGCHAO",
  "DIVYESH A/L MAGESHWARAN",
  "MOHAMAD RAZIN BIN ROSLI",
  "AIZIQ RAFIZI B ASMADI",
  "KEE CHEN KANG",
  "JERRY LIM",
  "TAN BO NIAN",
  "TEY LING CHYI",
  "VIVEGAN MAGISWARIN",
  "ZAROL MAHARI BIN MOHD ALI",
  "LEE BOON XIANG",
  "LOO CHIN CHYE",
  "TAN PANG FOOK",
  "GONG WEI SIONG",
  "MOHD. HAFIZ BIN MOHD. FARID",
  "JUSTINA TAY",
  "CATTHARINE YEO",
  "CHONG HONG KIAT",
  "JEFFREY",
  "LEE SHEAH LIANG",
  "NG YONG WEI",
];

const identityTokens = (value: string) =>
  normalizeName(value)
    .replace(/[^A-Z0-9]+/g, " ")
    .split(/\s+/)
    .filter(
      (token) =>
        Boolean(token) &&
        !["DR", "DOCTOR", "MR", "MRS", "MS", "MISS", "PROF"].includes(token)
    );

const identityCoreTokens = (value: string) => {
  const tokens = identityTokens(value);
  const connectorIndex = tokens.findIndex((token) =>
    ["B", "BIN", "BI", "BINTI", "BT"].includes(token)
  );
  return connectorIndex > 0 ? tokens.slice(0, connectorIndex) : tokens;
};

const playerNameMatchScore = (left: string, right: string) => {
  const leftTokens = identityTokens(left);
  const rightTokens = identityTokens(right);
  const leftNormalized = leftTokens.join(" ");
  const rightNormalized = rightTokens.join(" ");

  if (leftNormalized === rightNormalized) return 1000;

  const shorter =
    leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer =
    leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;

  if (shorter.length < 2) return 0;

  const longerCore =
    leftTokens.length <= rightTokens.length
      ? identityCoreTokens(right)
      : identityCoreTokens(left);
  const isCoreSubset = shorter.every((token) => longerCore.includes(token));
  const isGeneralSubset = shorter.every((token) => longer.includes(token));

  if (isCoreSubset) return 500 + shorter.length * 10;
  if (isGeneralSubset) return 100 + shorter.length * 10;
  return 0;
};

const findBestPlayerMatchIndex = (
  names: string[],
  playerName: string
) => {
  let bestIndex = -1;
  let bestScore = 0;

  names.forEach((name, index) => {
    const score = playerNameMatchScore(name, playerName);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
};

type RegistrationRanking = {
  playerName: string;
  normalizedName?: string;
  category: string;
  points: number;
  titles?: number;
  wins?: number;
};

const getSystemCategory = (category: string) =>
  category === "MIX SINGLES OPEN"
    ? "Open Category"
    : category === "MIX SINGLES BEGINNER"
      ? "Beginner Category"
      : category;

export default function RegistrationPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [tournamentId, setTournamentId] = useState("");
  const [tournamentName, setTournamentName] = useState("JB Monthly Medal");
  const [tournamentDate, setTournamentDate] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [origin, setOrigin] = useState("");
  const [shirtSize, setShirtSize] = useState("");
  const [otherShirtSize, setOtherShirtSize] = useState("");
  const [shirtPickerOpen, setShirtPickerOpen] = useState(false);
  const [category, setCategory] = useState("MIX SINGLES BEGINNER");
  const [ntrpLevel, setNtrpLevel] = useState("");
  const [nationalPlayerStatus, setNationalPlayerStatus] = useState("");
  const [checkingCapacity, setCheckingCapacity] = useState(false);
  const [checkingRanking, setCheckingRanking] = useState(false);
  const [rankingRecords, setRankingRecords] = useState<RegistrationRanking[]>([]);
  const [showQrPay, setShowQrPay] = useState(false);
  const [showNtrpInfo, setShowNtrpInfo] = useState(false);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTournament = async () => {
      const liveSnapshot = await getDoc(doc(db, "currentTournament", "live"));
      const liveId = liveSnapshot.exists()
        ? String(liveSnapshot.data().tournamentId || "")
        : "";

      if (!liveId) {
        setError("No active tournament is currently accepting registrations.");
        return;
      }

      const tournamentSnapshot = await getDoc(doc(db, "tournaments", liveId));
      if (!tournamentSnapshot.exists()) {
        setError("The active tournament could not be found.");
        return;
      }

      const data = tournamentSnapshot.data();
      setTournamentId(liveId);
      setTournamentName(data.tournamentName || "JB Monthly Medal");
      setTournamentDate(data.tournamentDate || "");
    };

    loadTournament().catch(() => {
      setError("Unable to load registration details. Please try again.");
    });
  }, []);

  const validateStep = (step: number) => {
    if (
      step === 1 &&
      (!fullName.trim() ||
        !dateOfBirth ||
        !phone.trim() ||
        !email.trim() ||
        !origin.trim() ||
        !shirtSize ||
        (shirtSize === "Others" && !otherShirtSize.trim()))
    ) {
      setError("Please complete all personal information.");
      return false;
    }

    if (step === 2 && (!category || !ntrpLevel || !nationalPlayerStatus)) {
      setError(
        "Please select your category, NTRP level and national player status."
      );
      return false;
    }

    if (step === 2 && nationalPlayerStatus === "yes") {
      setError(
        "National players are not eligible to register for this tournament."
      );
      return false;
    }

    if (step === 3 && (!paymentProof || !agreementAccepted)) {
      setError("Please upload payment proof and accept the attendance rules.");
      return false;
    }

    if (
      step === 3 &&
      paymentProof &&
      !paymentProof.type.startsWith("image/") &&
      paymentProof.type !== "application/pdf"
    ) {
      setError("Proof of payment must be an image or PDF file.");
      return false;
    }

    if (step === 3 && paymentProof && paymentProof.size > 5 * 1024 * 1024) {
      setError("Proof of payment must be smaller than 5MB.");
      return false;
    }

    setError("");
    return true;
  };

  const isCategoryFull = async () => {
    const snapshot = await getDocs(collection(db, "registrations"));
    const systemCategory = getSystemCategory(category);
    const activeRegistrations = snapshot.docs.filter((registration) => {
      const data = registration.data();
      return (
        data.tournamentId === tournamentId &&
        data.category === systemCategory &&
        data.status !== "rejected"
      );
    });

    return activeRegistrations.length >= CATEGORY_LIMIT;
  };

  const goNext = async () => {
    if (!validateStep(currentStep)) return;

    if (currentStep === 1) {
      setCheckingRanking(true);

      try {
        const rankingSnapshot = await getDocs(collection(db, "playerRankings"));
        setRankingRecords(
          rankingSnapshot.docs.map(
            (ranking) => ranking.data() as RegistrationRanking
          )
        );
      } catch {
        setRankingRecords([]);
      } finally {
        setCheckingRanking(false);
      }
    }

    if (currentStep === 2) {
      setCheckingCapacity(true);

      try {
        if (await isCategoryFull()) {
          setError(
            `Registration is full for ${category}. The category limit is ${CATEGORY_LIMIT} players.`
          );
          return;
        }
      } catch {
        setError("Unable to check category availability. Please try again.");
        return;
      } finally {
        setCheckingCapacity(false);
      }
    }

    setCurrentStep((step) => Math.min(step + 1, 4));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setError("");
    setCurrentStep((step) => Math.max(step - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!validateStep(3) || !paymentProof || !tournamentId) {
      if (!tournamentId) {
        setError("No active tournament is available.");
      }
      return;
    }

    const normalizedName = normalizeName(fullName);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, "");
    const systemCategory = getSystemCategory(category);
    const resolvedShirtSize =
      shirtSize === "Others" ? otherShirtSize.trim().toUpperCase() : shirtSize;
    const hasShirtSurcharge =
      shirtSize === "2XL" || shirtSize === "Others";
    const paymentAmount = hasShirtSurcharge ? 95 : 80;

    setSubmitting(true);
    setSubmitStatus("Checking registration...");

    try {
      const existing = await getDocs(collection(db, "registrations"));
      const duplicate = existing.docs.some((registration) => {
        const data = registration.data();
        return (
          data.tournamentId === tournamentId &&
          data.category === systemCategory &&
          data.status !== "rejected" &&
          (data.normalizedEmail === normalizedEmail ||
            data.normalizedPhone === normalizedPhone ||
            data.normalizedName === normalizedName)
        );
      });

      if (duplicate) {
        setError("A matching registration already exists for this tournament.");
        return;
      }

      const categoryRegistrationCount = existing.docs.filter((registration) => {
        const data = registration.data();
        return (
          data.tournamentId === tournamentId &&
          data.category === systemCategory &&
          data.status !== "rejected"
        );
      }).length;

      if (categoryRegistrationCount >= CATEGORY_LIMIT) {
        setError(
          `Registration is full for ${category}. The category limit is ${CATEGORY_LIMIT} players.`
        );
        return;
      }

      setSubmitStatus("Preparing receipt...");
      const receiptToUpload = await compressReceiptImage(paymentProof);
      const safeFileName = receiptToUpload.name.replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      );
      const paymentProofRef = ref(
        storage,
        `registration-payments/${tournamentId}/${Date.now()}-${safeFileName}`
      );
      const uploadTask = uploadBytesResumable(paymentProofRef, receiptToUpload, {
        contentType: receiptToUpload.type,
      });
      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            setSubmitStatus(`Uploading receipt ${progress}%...`);
          },
          reject,
          resolve
        );
      });
      const paymentProofUrl = await getDownloadURL(paymentProofRef);

      setSubmitStatus("Saving registration...");
      await addDoc(collection(db, "registrations"), {
        tournamentId,
        tournamentName,
        tournamentDate,
        fullName: fullName.trim().replace(/\s+/g, " "),
        normalizedName,
        dateOfBirth,
        phone: phone.trim(),
        normalizedPhone,
        email: normalizedEmail,
        normalizedEmail,
        origin: origin.trim(),
        shirtSize: resolvedShirtSize,
        shirtSizeOption: shirtSize,
        shirtSurcharge: hasShirtSurcharge ? 15 : 0,
        category: systemCategory,
        categoryLabel: category,
        ntrpLevel,
        rankingPosition: detectedRanking?.position ?? null,
        rankingPoints: detectedRanking?.row.points ?? 0,
        rankingStatus: detectedRanking ? "Ranked" : "NR",
        isNationalPlayer: false,
        nationalPlayerDeclaration: nationalPlayerStatus,
        eligibilityConfirmed: true,
        categoryLimit: CATEGORY_LIMIT,
        paymentAmount,
        paymentBank: "Maybank",
        paymentAccount: "551137776795",
        paymentProofUrl,
        paymentProofName: paymentProof.name,
        paymentProofStoredName: receiptToUpload.name,
        paymentProofOriginalSize: paymentProof.size,
        paymentProofStoredSize: receiptToUpload.size,
        paymentProofCompressed: receiptToUpload !== paymentProof,
        agreementAccepted: true,
        scheduleAcknowledged: true,
        status: "pending",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSubmitted(true);
    } catch {
      setError(
        "Registration could not be submitted. Please check the payment file and try again."
      );
    } finally {
      setSubmitting(false);
      setSubmitStatus("");
    }
  };

  const sortedRankingRows = [...rankingRecords].sort(
      (a, b) =>
        b.points - a.points ||
        (b.titles ?? 0) - (a.titles ?? 0) ||
        (b.wins ?? 0) - (a.wins ?? 0) ||
        a.playerName.localeCompare(b.playerName)
    );
  const officialRankingIndex = findBestPlayerMatchIndex(
    OFFICIAL_RANKING_NAMES,
    fullName
  );
  const databaseRankingIndex =
    officialRankingIndex >= 0
      ? findBestPlayerMatchIndex(
          sortedRankingRows.map((ranking) => ranking.playerName),
          OFFICIAL_RANKING_NAMES[officialRankingIndex]
        )
      : -1;
  const detectedRanking =
    officialRankingIndex >= 0
      ? {
          position: officialRankingIndex + 1,
          row:
            databaseRankingIndex >= 0
              ? sortedRankingRows[databaseRankingIndex]
              : {
                  playerName: OFFICIAL_RANKING_NAMES[officialRankingIndex],
                  normalizedName: normalizeName(
                    OFFICIAL_RANKING_NAMES[officialRankingIndex]
                  ),
                  category: getSystemCategory(category),
                  points: 0,
                },
          source:
            databaseRankingIndex >= 0
              ? ("database" as const)
              : ("official-list" as const),
        }
      : null;

  if (submitted) {
    return (
      <main className="registration-wizard-page registration-success-page">
        <section className="registration-success-card">
          <CheckCircle2 />
          <span>Registration submitted</span>
          <h1>Thank you, {fullName}</h1>
          <p>
            Your registration remains pending until the organiser verifies your
            proof of payment. Confirmation will be sent by email after approval.
          </p>
          <Link to="/">Back to Event Homepage</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-wizard-page">
      {showNtrpInfo && (
        <div
          className="wizard-qr-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ntrp-info-title"
          onClick={() => setShowNtrpInfo(false)}
        >
          <div
            className="wizard-ntrp-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowNtrpInfo(false)}
              className="wizard-qr-close"
              aria-label="Close NTRP information"
            >
              <X />
            </button>
            <span>NTRP Guide</span>
            <h2 id="ntrp-info-title">Find your estimated level</h2>
            <p>
              Use this quick guide to select the level that best reflects your
              current playing ability.
            </p>
            <div className="wizard-ntrp-levels">
              <article>
                <strong>Below 2.0</strong>
                <div>
                  <b>Development</b>
                  <p>New player learning basic movement, court positioning and racket control.</p>
                </div>
              </article>
              <article>
                <strong>2.0 – 2.5</strong>
                <div>
                  <b>Beginner</b>
                  <p>Learning rally fundamentals, ball control and how to keep the ball in play.</p>
                </div>
              </article>
              <article>
                <strong>3.0 – 3.5</strong>
                <div>
                  <b>Developing</b>
                  <p>Can sustain rallies and is developing consistency, placement and teamwork.</p>
                </div>
              </article>
              <article>
                <strong>3.5 – 4.0</strong>
                <div>
                  <b>Intermediate</b>
                  <p>Dependable strokes and first serve with stronger net play and doubles skills.</p>
                </div>
              </article>
              <article>
                <strong>Above 4.0</strong>
                <div>
                  <b>Advanced</b>
                  <p>Consistent power, spin, footwork and match strategy under competition.</p>
                </div>
              </article>
            </div>
            <small>This is an estimate only; choose the closest description.</small>
          </div>
        </div>
      )}

      {showQrPay && (
        <div
          className="wizard-qr-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="QR Pay"
          onClick={() => setShowQrPay(false)}
        >
          <div className="wizard-qr-modal" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowQrPay(false)}
              className="wizard-qr-close"
              aria-label="Close QR Pay"
            >
              <X />
            </button>
            <span>Scan to Pay</span>
            <h2>Zul Airi Bin Sudiro</h2>
            <img src="/qr-pay-zul-airi.png" alt="QR Pay for Zul Airi Bin Sudiro" />
            <strong>
              RM{shirtSize === "2XL" || shirtSize === "Others" ? 95 : 80}
            </strong>
            <p>After payment, upload the receipt below for verification.</p>
          </div>
        </div>
      )}

      <div className="registration-wizard-shell">
        <Link to="/" className="registration-wizard-back">
          ← JB Monthly Medal
        </Link>

        <header className="registration-wizard-hero">
          <span>Participant Registration</span>
          <h1>Register for {tournamentName}</h1>
          <p>
            Your registration remains pending until the organiser verifies your
            proof of payment.
          </p>
          {tournamentDate && <small>Tournament date · {tournamentDate}</small>}
        </header>

        <nav className="registration-wizard-progress" aria-label="Registration progress">
          {steps.map((label, index) => {
            const step = index + 1;
            const active = currentStep === step;
            const complete = currentStep > step;

            return (
              <button
                type="button"
                key={label}
                onClick={() => complete && setCurrentStep(step)}
                className={`${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
              >
                <span>{complete ? "✓" : step}</span>
                <strong>{label}</strong>
              </button>
            );
          })}
        </nav>

        <form onSubmit={submitRegistration} className="registration-wizard-card">
          {currentStep === 1 && (
            <WizardSection number="01" title="Personal Information">
              <WizardField label="Full Name *">
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your full name"
                />
              </WizardField>
              <div className="wizard-field">
                <span>Date of Birth *</span>
                <DateOfBirthPicker
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                />
              </div>
              <WizardField label="Email Address *">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="player@email.com"
                />
              </WizardField>
              <WizardField label="Phone Number (WhatsApp) *">
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0123456789"
                />
              </WizardField>
              <WizardField label="Where are you from? *">
                <input
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  placeholder="Johor Bahru, KL, Singapore, etc."
                />
              </WizardField>
              <WizardField label="T-Shirt Size *">
                <button
                  type="button"
                  className={
                    shirtPickerOpen
                      ? "wizard-shirt-trigger is-open"
                      : "wizard-shirt-trigger"
                  }
                  onClick={() => setShirtPickerOpen((open) => !open)}
                  aria-expanded={shirtPickerOpen}
                >
                  <span>{shirtSize || "Select size"}</span>
                  <span aria-hidden="true">{shirtPickerOpen ? "−" : "⌄"}</span>
                </button>
                {shirtPickerOpen && (
                  <div className="wizard-shirt-popover">
                    <div className="wizard-shirt-grid">
                      {shirtSizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            setShirtSize(size);
                            setShirtPickerOpen(false);
                          }}
                          className={shirtSize === size ? "is-selected" : ""}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {shirtSize === "Others" && (
                  <input
                    value={otherShirtSize}
                    onChange={(event) => setOtherShirtSize(event.target.value)}
                    placeholder="Enter size, e.g. XS or 3XL"
                    className="wizard-other-size"
                  />
                )}
                <small className="wizard-shirt-note">
                  2XL and above require an additional RM15.
                </small>
              </WizardField>
            </WizardSection>
          )}

          {currentStep === 2 && (
            <WizardSection number="02" title="Category & Level">
              <div className="wizard-ranking-detection">
                <div>
                  <span>Player Ranking</span>
                  <strong>{detectedRanking ? `#${detectedRanking.position}` : "NR"}</strong>
                </div>
                <div>
                  <strong>{fullName}</strong>
                  <p>
                    {detectedRanking
                      ? detectedRanking.source === "database"
                        ? `${detectedRanking.row.points} ranking points`
                        : "Matched with the official player identity list"
                      : "No ranking record found"}
                  </p>
                </div>
              </div>

              <WizardField label="Category *">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option>MIX SINGLES BEGINNER</option>
                  <option>MIX SINGLES OPEN</option>
                </select>
              </WizardField>
              <div className="wizard-field">
                <span className="wizard-field-label-with-info">
                  Estimated NTRP Level *
                  <button
                    type="button"
                    className="wizard-info-button"
                    onClick={() => setShowNtrpInfo(true)}
                    aria-label="View NTRP level information"
                    aria-haspopup="dialog"
                  >
                    <Info />
                  </button>
                </span>
                <select
                  value={ntrpLevel}
                  onChange={(event) => setNtrpLevel(event.target.value)}
                  aria-label="Estimated NTRP Level"
                >
                  <option value="">Select your level</option>
                  {ntrpLevels.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div className="wizard-category-note">
                <span>Eligibility</span>
                <p>
                  This tournament is open to participants of all ages. However,
                  SUKMA players above 15 years old and current or former
                  national players are not eligible to participate. Each
                  category is limited to 24 players.
                </p>
              </div>

              <div className="wizard-national-player">
                <span>Are you a current or former national player? *</span>
                <div>
                  {[
                    ["no", "No"],
                    ["yes", "Yes"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNationalPlayerStatus(value)}
                      className={
                        nationalPlayerStatus === value ? "is-selected" : ""
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </WizardSection>
          )}

          {currentStep === 3 && (
            <WizardSection number="03" title="Attendance & Payment">
              <div className="wizard-payment-card">
                <span>Registration Fee</span>
                <strong>
                  RM{shirtSize === "2XL" || shirtSize === "Others" ? 95 : 80}
                </strong>
                <dl>
                  <div>
                    <dt>Bank</dt>
                    <dd>Maybank</dd>
                  </div>
                  <div>
                    <dt>Account</dt>
                    <dd>551137776795</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => setShowQrPay(true)}
                  className="wizard-qr-trigger"
                >
                  <QrCode />
                  Click here for QR Pay
                </button>
                <small>
                  {shirtSize === "2XL" || shirtSize === "Others"
                    ? "Includes RM15 surcharge for 2XL and above. "
                    : ""}
                  If QR payment is needed, please text the admin.
                </small>
              </div>

              <WizardField label="Proof of Payment *" full>
                <label className="wizard-upload">
                  <Upload />
                  <span>
                    <strong>
                      {paymentProof ? paymentProof.name : "Upload payment receipt"}
                    </strong>
                    <small>Image or PDF · Maximum 5MB</small>
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    onChange={(event) =>
                      setPaymentProof(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </WizardField>

              <div className="wizard-rules">
                <span>Scheduling & Attendance</span>
                <ul>
                  <li>Matches are played on Sunday, 8:00 AM – 8:00 PM.</li>
                  <li>The match schedule will be released before Thursday.</li>
                  <li>Players must ensure availability for assigned matches.</li>
                </ul>
              </div>

              <label className="wizard-agreement">
                <input
                  type="checkbox"
                  checked={agreementAccepted}
                  onChange={(event) => setAgreementAccepted(event.target.checked)}
                />
                <span>
                  I have read and agree to the tournament rules, scheduling and
                  attendance requirements.
                </span>
              </label>
            </WizardSection>
          )}

          {currentStep === 4 && (
            <WizardSection number="04" title="Review Registration">
              <ReviewGroup title="Personal">
                <ReviewItem label="Full Name" value={fullName} />
                <ReviewItem label="Date of Birth" value={dateOfBirth} />
                <ReviewItem label="Email" value={email} />
                <ReviewItem label="WhatsApp" value={phone} />
                <ReviewItem label="From" value={origin} />
                <ReviewItem
                  label="T-Shirt"
                  value={
                    shirtSize === "Others"
                      ? otherShirtSize.trim().toUpperCase()
                      : shirtSize
                  }
                />
              </ReviewGroup>
              <ReviewGroup title="Category">
                <ReviewItem label="Category" value={category} />
                <ReviewItem label="NTRP Level" value={ntrpLevel} />
                <ReviewItem
                  label="Player Ranking"
                  value={
                    detectedRanking ? `#${detectedRanking.position}` : "NR"
                  }
                />
                <ReviewItem
                  label="National Player"
                  value={nationalPlayerStatus === "yes" ? "Yes" : "No"}
                />
              </ReviewGroup>
              <ReviewGroup title="Payment">
                <ReviewItem
                  label="Amount"
                  value={`RM${
                    shirtSize === "2XL" || shirtSize === "Others" ? 95 : 80
                  }`}
                />
                <ReviewItem label="Bank" value="Maybank · 551137776795" />
                <ReviewItem
                  label="Proof"
                  value={paymentProof?.name || "Not uploaded"}
                />
              </ReviewGroup>
            </WizardSection>
          )}

          {error && <p className="registration-wizard-error">{error}</p>}

          <footer className="registration-wizard-actions">
            {currentStep === 1 ? (
              <Link to="/" className="wizard-secondary-button">
                Cancel
              </Link>
            ) : (
              <button type="button" onClick={goBack} className="wizard-secondary-button">
                <ChevronLeft />
                Back
              </button>
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={checkingCapacity || checkingRanking}
                className="wizard-primary-button"
              >
                {checkingRanking
                  ? "Checking player ranking..."
                  : checkingCapacity
                    ? "Checking availability..."
                    : "Continue"}
                <ChevronRight />
              </button>
            ) : (
              <div className="wizard-submit-progress">
                {submitting && (
                  <span role="status" aria-live="polite">
                    {submitStatus}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={submitting || !tournamentId}
                  className="wizard-primary-button"
                >
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  {submitting ? submitStatus : "Submit Registration"}
                </button>
              </div>
            )}
          </footer>
        </form>
      </div>
    </main>
  );
}

function WizardSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wizard-section">
      <header>
        <span>{number}</span>
        <h2>{title}</h2>
      </header>
      <div className="wizard-field-grid">{children}</div>
    </section>
  );
}

function WizardField({
  label,
  full = false,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "wizard-field wizard-field-full" : "wizard-field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ReviewGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wizard-review-group">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="wizard-review-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function DateOfBirthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const today = new Date();
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const [open, setOpen] = useState(false);
  const [pickerView, setPickerView] = useState<
    "calendar" | "months" | "years"
  >("calendar");
  const [viewDate, setViewDate] = useState(
    selectedDate ?? new Date(today.getFullYear() - 20, today.getMonth(), 1)
  );
  const monthNames = Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat("en", { month: "short" }).format(
      new Date(2024, month, 1)
    )
  );
  const years = Array.from(
    { length: 121 },
    (_, index) => today.getFullYear() - index
  );
  const firstDay = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1
  );
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0
  ).getDate();
  const calendarCells = [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const openPicker = () => {
    if (selectedDate) {
      setViewDate(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      );
    }
    setPickerView("calendar");
    setOpen(true);
  };

  const selectDay = (day: number) => {
    const nextDate = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth(),
      day
    );
    if (nextDate > today) return;

    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, "0");
    const date = String(day).padStart(2, "0");
    onChange(`${year}-${month}-${date}`);
    setOpen(false);
  };

  const moveMonth = (offset: number) => {
    setViewDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1)
    );
  };

  const isCurrentOrFutureMonth =
    viewDate.getFullYear() >= today.getFullYear() &&
    viewDate.getMonth() >= today.getMonth();

  return (
    <div className="wizard-dob-picker">
      <button
        type="button"
        className="wizard-dob-trigger"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>
          {selectedDate
            ? new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(selectedDate)
            : "Select date of birth"}
        </span>
        <CalendarDays />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="wizard-date-backdrop"
            onClick={() => setOpen(false)}
            aria-label="Close date picker"
          />
          <div
            className="wizard-date-popover"
            role="dialog"
            aria-label="Choose date of birth"
          >
            <header>
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft />
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => setPickerView("months")}
                >
                  {monthNames[viewDate.getMonth()]}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerView("years")}
                >
                  {viewDate.getFullYear()}
                </button>
              </div>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                disabled={isCurrentOrFutureMonth}
                aria-label="Next month"
              >
                <ChevronRight />
              </button>
            </header>

            {pickerView === "years" && (
              <div className="wizard-year-grid">
                {years.map((year) => (
                  <button
                    type="button"
                    key={year}
                    className={
                      year === viewDate.getFullYear() ? "is-selected" : ""
                    }
                    onClick={() => {
                      setViewDate(
                        (current) =>
                          new Date(year, current.getMonth(), 1)
                      );
                      setPickerView("months");
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}

            {pickerView === "months" && (
              <div className="wizard-month-grid">
                {monthNames.map((month, index) => {
                  const unavailable =
                    viewDate.getFullYear() === today.getFullYear() &&
                    index > today.getMonth();
                  return (
                    <button
                      type="button"
                      key={month}
                      disabled={unavailable}
                      className={
                        index === viewDate.getMonth() ? "is-selected" : ""
                      }
                      onClick={() => {
                        setViewDate(
                          (current) =>
                            new Date(current.getFullYear(), index, 1)
                        );
                        setPickerView("calendar");
                      }}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            )}

            {pickerView === "calendar" && (
              <>
                <div className="wizard-date-weekdays">
                  {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="wizard-date-days">
                  {calendarCells.map((day, index) =>
                    day ? (
                      <button
                        type="button"
                        key={`${viewDate.getMonth()}-${day}`}
                        disabled={
                          new Date(
                            viewDate.getFullYear(),
                            viewDate.getMonth(),
                            day
                          ) > today
                        }
                        className={
                          selectedDate &&
                          selectedDate.getFullYear() === viewDate.getFullYear() &&
                          selectedDate.getMonth() === viewDate.getMonth() &&
                          selectedDate.getDate() === day
                            ? "is-selected"
                            : ""
                        }
                        onClick={() => selectDay(day)}
                      >
                        {day}
                      </button>
                    ) : (
                      <span key={`empty-${index}`} />
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
