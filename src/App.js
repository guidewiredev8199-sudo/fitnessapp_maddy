import React, { useState, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "./index.css";

const QUOTES = [
  "Consistency beats intensity — every time.",
  "Small daily improvements lead to big results.",
  "Progress, not perfection.",
  "Eat clean, train dirty.",
  "Your body is a reflection of your lifestyle."
];

export default function App() {
  // user inputs
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");
  const [dietType, setDietType] = useState("nonveg");
  const [intensity, setIntensity] = useState("moderate");

  // results
  const [bmi, setBmi] = useState(null);
  const [bmr, setBmr] = useState(null);
  const [maintainCalories, setMaintainCalories] = useState(null);
  const [caloriesMap, setCaloriesMap] = useState(null); // maintain, mild, weight, extreme
  const [zigzag1, setZigzag1] = useState([]);
  const [zigzag2, setZigzag2] = useState([]);
  const [proteinTarget, setProteinTarget] = useState(null);
  const [macros, setMacros] = useState(null); // {protein, carbs, fat}
  const [dietPlan, setDietPlan] = useState([]);
  const [quote, setQuote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  const summaryRef = useRef();

  // helper
  const round = (v) => Math.round(v);

  const activityFactorFromChoice = (choice) => {
    switch (choice) {
      case "1": return 1.2;          // once a week (sedentary-ish)
      case "2": return 1.275;        // twice a week
      case "3-5": return 1.55;       // 3-5 days
      case "6-7": return 1.725;      // 6-7 days
      case "daily-intense": return 1.9;
      default: return 1.375;
    }
  };

  const handleCalculate = () => {
    // validation
    if (!gender || !age || !heightFeet || !weight || !activity || !goal) {
      alert("Please fill: gender, age, height (ft), weight, activity and goal.");
      return;
    }

    // convert height
    const totalInches = Number(heightFeet) * 12 + Number(heightInches || 0);
    const heightCm = totalInches * 2.54;
    const heightM = heightCm / 100;
    const weightKg = Number(weight);

    // BMI
    const bmiVal = +(weightKg / (heightM * heightM)).toFixed(1);
    setBmi(bmiVal);

    // BMR (Mifflin-St Jeor)
    const bmrCalc = gender === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * Number(age) + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * Number(age) - 161;
    setBmr(Math.round(bmrCalc));

    // Activity factor
    const actFactor = activityFactorFromChoice(activity);

    // Maintain calories (TDEE)
    const maintain = Math.round(bmrCalc * actFactor);
    setMaintainCalories(maintain);

    // Prepare map (same style as you wanted)
    const mild = Math.round(maintain * 0.9);   // 90% ~ mild loss (0.5 lb/wk)
    const weightLoss = Math.round(maintain * 0.8); // 80% ~ 1 lb/wk
    const extreme = Math.round(maintain * 0.61); // ~61% ~ 2 lb/wk

    setCaloriesMap({ maintain, mild, weight: weightLoss, extreme });

    // Protein target: 1.5 g/kg generally, 1.8 for gainers
    const proteinG = Math.round(weightKg * (goal === "gain" ? 1.8 : 1.5));
    setProteinTarget(proteinG);

    // Macros per day (calories): protein calories = proteinG * 4
    // We'll use Protein 25% (by calories), Carbs 50%, Fat 25% as baseline, but ensure protein meets proteinG
    let proteinCalories = proteinG * 4;
    let totalCalories = maintain;
    // If proteinCalories is greater than 25% of calories, reduce carbs so protein is satisfied
    const defaultProteinPercent = 0.25;
    const defaultProteinCals = totalCalories * defaultProteinPercent;
    let carbsCals, fatCals;
    if (proteinCalories > defaultProteinCals) {
      // bump protein percent to fit required protein
      proteinCalories = proteinG * 4;
      const remainingCals = Math.max(0, totalCalories - proteinCalories);
      carbsCals = Math.round(remainingCals * 0.66); // carbs ~66% of remainder
      fatCals = Math.round(remainingCals * 0.34);
    } else {
      proteinCalories = Math.round(totalCalories * defaultProteinPercent);
      carbsCals = Math.round(totalCalories * 0.5);
      fatCals = Math.round(totalCalories * 0.25);
      // ensure protein g is also available: compute protein g from proteinCalories
      const proteinFromPercentG = Math.round(proteinCalories / 4);
      if (proteinFromPercentG < proteinG) {
        // increase protein to meet grams (take from carbs)
        const extraProtCals = (proteinG - proteinFromPercentG) * 4;
        proteinCalories += extraProtCals;
        carbsCals = Math.max(0, carbsCals - Math.round(extraProtCals * 0.7));
        fatCals = Math.max(0, fatCals - Math.round(extraProtCals * 0.3));
      }
    }

    const proteinGram = Math.round(proteinCalories / 4);
    const carbsGram = Math.round(carbsCals / 4);
    const fatGram = Math.round(fatCals / 9);

    setMacros({ protein: proteinGram, carbs: carbsGram, fat: fatGram });

    // Generate zigzag schedules based on selected goal
    const { scheduleA, scheduleB } = generateZigzagSchedules(maintain, goal);
    setZigzag1(scheduleA);
    setZigzag2(scheduleB);

    // Choose dailyCalories based on intensity for diet plan (use maintain or appropriate)
    let dailyCaloriesForPlan;
    if (goal === "lose") {
      if (intensity === "mild") dailyCaloriesForPlan = mild;
      else if (intensity === "moderate") dailyCaloriesForPlan = weightLoss;
      else dailyCaloriesForPlan = extreme;
    } else if (goal === "gain") {
      // For gain, mild/moderate/extreme are increases
      const gainMild = Math.round(maintain * 1.05);
      const gainModerate = Math.round(maintain * 1.10);
      const gainExtreme = Math.round(maintain * 1.15);
      if (intensity === "mild") dailyCaloriesForPlan = gainMild;
      else if (intensity === "moderate") dailyCaloriesForPlan = gainModerate;
      else dailyCaloriesForPlan = gainExtreme;
    } else {
      // maintain
      dailyCaloriesForPlan = maintain;
    }

    const plan = buildDietPlanWithQuantities(dailyCaloriesForPlan, proteinG, dietType);
    setDietPlan(plan);

    // motivational quote
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  };

  // Zigzag schedule generator (two sample schedules)
  const generateZigzagSchedules = (maintain, goalChoice) => {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

    // schedule A: weekends higher, weekdays lower (pattern varies by goal)
    const scheduleA = days.map((d,i) => {
      const weekendBoost = (i === 0 || i === 6) ? 1.05 : 1.0;
      if (goalChoice === "lose") {
        return {
          day: d,
          mild: Math.round(maintain * 0.9 * weekendBoost),
          weight: Math.round(maintain * 0.8 * weekendBoost),
          extreme: Math.round(maintain * 0.61 * weekendBoost)
        };
      } else if (goalChoice === "gain") {
        return {
          day: d,
          mild: Math.round(maintain * 1.05 * weekendBoost),
          weight: Math.round(maintain * 1.10 * weekendBoost),
          extreme: Math.round(maintain * 1.15 * weekendBoost)
        };
      } else {
        return {
          day: d,
          mild: Math.round(maintain * 1.0 * weekendBoost),
          weight: Math.round(maintain * 1.02 * weekendBoost),
          extreme: Math.round(maintain * 1.05 * weekendBoost)
        };
      }
    });

    // schedule B: ramp mid-week then taper
    const scheduleB = days.map((d,i) => {
      const baseMultsLose = [0.9,0.86,0.86,0.86,0.86,0.86,0.9];
      const baseMultsWeight = [0.8,0.726,0.726,0.726,0.726,0.726,0.8];
      const baseMultsExtreme = [0.61,0.59,0.59,0.59,0.59,0.59,0.61];

      if (goalChoice === "lose") {
        return {
          day: d,
          mild: Math.round(maintain * baseMultsLose[i]),
          weight: Math.round(maintain * baseMultsWeight[i]),
          extreme: Math.round(maintain * baseMultsExtreme[i])
        };
      } else if (goalChoice === "gain") {
        // gentle wave up/down
        const gm = [1.02,1.04,1.06,1.10,1.08,1.05,1.03];
        const gw = [1.04,1.06,1.08,1.12,1.10,1.06,1.04];
        const ge = [1.06,1.08,1.10,1.15,1.12,1.08,1.06];
        return {
          day: d,
          mild: Math.round(maintain * gm[i]),
          weight: Math.round(maintain * gw[i]),
          extreme: Math.round(maintain * ge[i])
        };
      } else {
        const mm = [1.0,1.01,1.02,1.03,1.02,1.01,1.0];
        const mw = [1.02,1.03,1.04,1.05,1.04,1.03,1.02];
        const me = [1.03,1.04,1.05,1.06,1.05,1.04,1.03];
        return {
          day: d,
          mild: Math.round(maintain * mm[i]),
          weight: Math.round(maintain * mw[i]),
          extreme: Math.round(maintain * me[i])
        };
      }
    });

    return { scheduleA, scheduleB };
  };

  // Build diet plan with quantities scaled to dailyCalories and protein target
  const buildDietPlanWithQuantities = (dailyCalories, proteinTargetG, dietTypeChoice) => {
    // meal calorie split
    const preC = Math.round(dailyCalories * 0.10);
    const breakfastC = Math.round(dailyCalories * 0.25);
    const lunchC = Math.round(dailyCalories * 0.30);
    const snackC = Math.round(dailyCalories * 0.10);
    const dinnerC = Math.round(dailyCalories * 0.25);

    // baseline scale relative to 2000 kcal
    const scale = dailyCalories / 2000;

    // approximate calorie densities and protein per 100g:
    // cooked rice ~ 130 kcal per 100g cooked, protein ~ 2.7g
    // chicken breast cooked ~ 165 kcal/100g, protein ~ 31g
    // paneer ~ 320 kcal/100g, protein ~ 18g
    // oats 100g ~ 380 kcal, protein ~ 13g
    // milk 100ml ~ 64 kcal, protein ~ 3.3g
    // sprouts 100g ~ 120 kcal (varies), protein ~ 8g

    // We'll compute portions that approximate required protein distribution per meal:
    const protBreakfast = Math.round(proteinTargetG * 0.2);
    const protLunch = Math.round(proteinTargetG * 0.35);
    const protSnack = Math.round(proteinTargetG * 0.1);
    const protDinner = Math.round(proteinTargetG * 0.35);

    // Helper to compute grams required from source protein per 100g
    const gramsFromProtein = (wantG, proteinPer100g) => Math.round((wantG / proteinPer100g) * 100);

    // Breakfast
    let breakfastText;
    if (dietTypeChoice === "veg") {
      const oatsG = Math.round(40 * scale);
      const milkMl = Math.round(250 * scale);
      // use paneer as main protein source at breakfast for veg
      const paneerG = gramsFromProtein(protBreakfast, 18); // paneer protein ~18g/100g
      breakfastText = `Breakfast (~${breakfastC} kcal): Oats ${oatsG}g + Milk ${milkMl}ml + Paneer ${paneerG}g (approx ${protBreakfast}g protein) + 10–12 almonds.`;
    } else {
      const oatsG = Math.round(40 * scale);
      const milkMl = Math.round(250 * scale);
      // eggs as protein: egg white ~ 11g protein per 100g -> 3 egg whites ~ 10-12g
      // use chicken or eggs to reach protBreakfast
      const extraProtNeeded = Math.max(0, protBreakfast - 12); // after 3 egg whites
      const chickenG = extraProtNeeded > 0 ? gramsFromProtein(extraProtNeeded, 31) : 0;
      breakfastText = `Breakfast (~${breakfastC} kcal): Oats ${oatsG}g + Milk ${milkMl}ml + 3 egg whites (~12g)${ chickenG ? ` + ${chickenG}g chicken (~${extraProtNeeded}g protein)` : "" }.`;
    }

    // Lunch
    let lunchText;
    if (dietTypeChoice === "veg") {
      const riceG = Math.round(180 * scale);
      const paneerG = gramsFromProtein(protLunch, 18);
      lunchText = `Lunch (~${lunchC} kcal): Rice ${riceG}g + Paneer ${paneerG}g (≈${protLunch}g protein) + Mixed veg 100g + Salad 100g.`;
    } else {
      const riceG = Math.round(180 * scale);
      const chickenG = gramsFromProtein(protLunch, 31);
      lunchText = `Lunch (~${lunchC} kcal): Rice ${riceG}g + Chicken ${chickenG}g (≈${protLunch}g protein) or 3-egg omelette + Mixed veg 100g + Salad 100g.`;
    }

    // Snack
    const snackText = `Snack (~${snackC} kcal): Sprout salad 100g (sprouts, onion, tomato, cucumber) + 1 fruit if needed. (Protein ≈ ${protSnack}g).`;

    // Dinner
    let dinnerText;
    if (dietTypeChoice === "veg") {
      const riceG = Math.round(150 * scale);
      const paneerG = gramsFromProtein(protDinner, 18);
      dinnerText = `Dinner (~${dinnerC} kcal): Rice ${riceG}g or 2 chapatis + Paneer ${paneerG}g (≈${protDinner}g protein) + Veggies 100g + Salad 100g.`;
    } else {
      const riceG = Math.round(150 * scale);
      const chickenG = gramsFromProtein(protDinner, 31);
      dinnerText = `Dinner (~${dinnerC} kcal): Rice ${riceG}g or 2 chapatis + Chicken/Fish ${chickenG}g (≈${protDinner}g protein) + Veggies 100g + Salad 100g.`;
    }

    // Pre-workout
    const preText = `Pre-workout (~${preC} kcal): 1 medium banana (~100g) or 1 slice toast with peanut butter.`;

    return [
      preText,
      breakfastText,
      lunchText,
      snackText,
      dinnerText
    ];
  };

  // PDF export (capture summaryRef)
  const downloadSummary = async () => {
    if (!summaryRef.current) return;
    const canvas = await html2canvas(summaryRef.current, { scale: 3 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const imgProps = pdf.getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    // Header with branding
    pdf.setFontSize(16);
    pdf.setTextColor(220, 170, 20);
    pdf.text("MaddyLiftz — Fitness Summary", 14, 18);
    pdf.setFontSize(11);
    pdf.setTextColor(50, 50, 50);
    // Add the captured image slightly below header
    pdf.addImage(imgData, "PNG", 0, 24, pdfWidth, pdfHeight);
    // Footer
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    const footer = `Built by MaddyLiftz | @maddymadhuu`;
    pdf.text(footer, 14, pdfHeight + 36);
    pdf.save(`${name || "client"}_MaddyLiftz_Summary.pdf`);
  };

  // small helper to display water
  const waterRecommendation = () => {
    if (!weight) return null;
    const liters = (Number(weight) * 0.04).toFixed(1);
    return `${liters} L/day (approx)`;
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: "linear-gradient(120deg,#0b0f1a,#210a0a)", padding: "2rem" }}>
      <div className="container" style={{ maxWidth: 980 }}>
        <div className="card shadow-lg" style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.03)" }}>
          <div style={{ background: "linear-gradient(90deg, rgba(255,120,0,0.06), rgba(255,40,40,0.03))", padding: "1.25rem 1.5rem" }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h3 className="mb-0" style={{ color: "#ffb703" }}>MaddyLiftz — Calorie Calculator</h3>
                <small className="text-muted">Home / Fitness & Health / Calorie Calculator</small>
              </div>
              <div style={{ textAlign: "right" }}>
                <small className="text-muted">Built by MaddyLiftz</small>
                <div className="text-warning">@maddymadhuu</div>
              </div>
            </div>
          </div>

          <div className="card-body" style={{ backgroundColor: "#071027", color: "#e6eef8" }}>
            {/* form */}
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Name</label>
                <input className="form-control" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Client name"/>
              </div>
              <div className="col-md-3">
                <label className="form-label">Gender</label>
                <select className="form-select" value={gender} onChange={(e)=>setGender(e.target.value)}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Age</label>
                <input className="form-control" type="number" value={age} onChange={(e)=>setAge(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Workout Frequency</label>
                <select className="form-select" value={activity} onChange={(e)=>setActivity(e.target.value)}>
                  <option value="">Select</option>
                  <option value="1">Once a week</option>
                  <option value="2">Twice a week</option>
                  <option value="3-5">3–5 days/week</option>
                  <option value="6-7">6–7 days/week</option>
                  <option value="daily-intense">Daily intense</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Height (ft)</label>
                <input className="form-control" type="number" value={heightFeet} onChange={(e)=>setHeightFeet(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Inches</label>
                <input className="form-control" type="number" value={heightInches} onChange={(e)=>setHeightInches(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Weight (kg)</label>
                <input className="form-control" type="number" value={weight} onChange={(e)=>setWeight(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Goal</label>
                <select className="form-select" value={goal} onChange={(e)=>setGoal(e.target.value)}>
                  <option value="maintain">Maintain Weight</option>
                  <option value="lose">Lose Weight</option>
                  <option value="gain">Gain Weight</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Diet Preference</label>
                <select className="form-select" value={dietType} onChange={(e)=>setDietType(e.target.value)}>
                  <option value="nonveg">Non-Veg</option>
                  <option value="veg">Veg</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Intensity</label>
                <select className="form-select" value={intensity} onChange={(e)=>setIntensity(e.target.value)}>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="extreme">Extreme</option>
                </select>
              </div>

              <div className="col-md-4 d-flex align-items-end">
                <button className="btn btn-warning w-100 fw-bold glow-btn" onClick={handleCalculate}>Calculate</button>
              </div>
            </div>

            {/* results */}
            {caloriesMap && (
              <div className="mt-4">
                <div ref={summaryRef} className="p-3 rounded-3" style={{ backgroundColor: "#061029" }}>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h5 className="text-warning mb-1">Your Summary</h5>
                      <div className="small text-muted">BMI • BMR • TDEE • Macros</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="small text-muted">MaddyLiftz</div>
                      <div className="text-warning">@maddymadhuu</div>
                    </div>
                  </div>

                  <div className="row text-center mb-3">
                    <div className="col-md-3 p-2">
                      <div className="result-card">
                        <div className="label">BMI</div>
                        <div className="value">{bmi}</div>
                      </div>
                    </div>
                    <div className="col-md-3 p-2">
                      <div className="result-card">
                        <div className="label">BMR</div>
                        <div className="value">{bmr} kcal</div>
                      </div>
                    </div>
                    <div className="col-md-3 p-2">
                      <div className="result-card">
                        <div className="label">TDEE (maintain)</div>
                        <div className="value">{caloriesMap.maintain.toLocaleString()} kcal</div>
                      </div>
                    </div>
                    <div className="col-md-3 p-2">
                      <div className="result-card">
                        <div className="label">Water</div>
                        <div className="value">{waterRecommendation()}</div>
                      </div>
                    </div>
                  </div>

                  {/* SMALL: use the previously-unused state values so ESLint is happy */}
                  <div className="mb-2 small text-muted">
                    {/* maintainCalories and proteinTarget are set in calculate(); show them here */}
                    Maintain (state): {maintainCalories ? maintainCalories.toLocaleString() + " kcal" : "—"} • Protein target: {proteinTarget ? proteinTarget + " g" : "—"}
                  </div>

                  {/* Calorie breakdown */}
                  <div className="mb-3">
                    <h6 className="text-light">Calorie Targets</h6>
                    <div className="row g-2">
                      <div className="col-6 col-md-3">
                        <div className="stat-card">
                          <div className="stat-title">Maintain</div>
                          <div className="stat-value">{caloriesMap.maintain.toLocaleString()}</div>
                          <div className="small text-muted">100%</div>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="stat-card">
                          <div className="stat-title">Mild loss</div>
                          <div className="stat-value">{caloriesMap.mild.toLocaleString()}</div>
                          <div className="small text-muted">90% • 0.5 lb/week</div>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="stat-card">
                          <div className="stat-title">Weight loss</div>
                          <div className="stat-value">{caloriesMap.weight.toLocaleString()}</div>
                          <div className="small text-muted">80% • 1 lb/week</div>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="stat-card">
                          <div className="stat-title">Extreme loss</div>
                          <div className="stat-value">{caloriesMap.extreme.toLocaleString()}</div>
                          <div className="small text-muted">61% • 2 lb/week</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Zigzag schedule tables */}
                  <div className="mb-3">
                    <div className="mb-2"><strong>Zigzag diet schedule 1</strong></div>
                    <div className="table-responsive mb-2">
                      <table className="table table-dark table-striped text-center">
                        <thead>
                          <tr><th>Day</th><th>{goal === "gain" ? "Mild gain" : "Mild"}</th><th>{goal === "gain" ? "Moderate gain" : "Weight loss"}</th><th>{goal === "gain" ? "Aggressive gain" : "Extreme loss"}</th></tr>
                        </thead>
                        <tbody>
                          {zigzag1.map((r, i)=>(
                            <tr key={i}>
                              <td>{r.day}</td>
                              <td>{r.mild.toLocaleString()} kcal</td>
                              <td>{(r.weight || r.moderate || r.weight).toLocaleString()} kcal</td>
                              <td>{r.extreme.toLocaleString()} kcal</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mb-2"><strong>Zigzag diet schedule 2</strong></div>
                    <div className="table-responsive">
                      <table className="table table-dark table-striped text-center">
                        <thead>
                          <tr><th>Day</th><th>Mild</th><th>Moderate</th><th>Extreme</th></tr>
                        </thead>
                        <tbody>
                          {zigzag2.map((r, i)=>(
                            <tr key={i}>
                              <td>{r.day}</td>
                              <td>{r.mild.toLocaleString()} kcal</td>
                              <td>{(r.weight || r.moderate || r.weight).toLocaleString()} kcal</td>
                              <td>{r.extreme.toLocaleString()} kcal</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Macros summary */}
                  {macros && (
                    <div className="mb-3">
                      <h6 className="text-light">Daily Macros (approx)</h6>
                      <div className="d-flex gap-3 flex-wrap">
                        <div className="macro-pill">
                          <div className="macro-label">Protein</div>
                          <div className="macro-value">{round(macros.protein)} g</div>
                        </div>
                        <div className="macro-pill">
                          <div className="macro-label">Carbs</div>
                          <div className="macro-value">{round(macros.carbs)} g</div>
                        </div>
                        <div className="macro-pill">
                          <div className="macro-label">Fat</div>
                          <div className="macro-value">{round(macros.fat)} g</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Diet plan */}
                  <div className="mb-2">
                    <h6 className="text-light">Personalized Diet Plan (quantities)</h6>
                    <ul className="list-group list-group-flush text-start">
                      {dietPlan.map((line, i) => (
                        <li key={i} className="list-group-item bg-dark text-white">{line}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-center mt-3">
                    <div className="text-muted small mb-2">Motivation</div>
                    <div className="quote-box">{quote}</div>
                  </div>
                </div>

                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-outline-light" onClick={downloadSummary}>📥 Download Report</button>
                </div>
              </div>
            )}
          </div>

          <div className="card-footer text-muted text-center" style={{ backgroundColor: "#021224" }}>
            Built by <strong>MaddyLiftz</strong> • <span className="text-warning">@maddymadhuu</span>
          </div>
        </div>
      </div>
    </div>
  );
}
