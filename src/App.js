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
  const [theme, setTheme] = useState("dark");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");
  const [dietType, setDietType] = useState("");
  const [intensity, setIntensity] = useState("");

  const [loading, setLoading] = useState(false);

  // results
  const [bmi, setBmi] = useState(null);
  const [bmr, setBmr] = useState(null);
  const [tdee, setTdee] = useState(null);
  const [protein, setProtein] = useState(null);
  const [zigzagCalories, setZigzagCalories] = useState([]);
  const [dietPlan, setDietPlan] = useState([]);
  const [caloriesMap, setCaloriesMap] = useState(null);
  const [macros, setMacros] = useState(null);
  const [quote, setQuote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  const summaryRef = useRef();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const isDark = theme === "dark";

  // helper
  const round = (v) => Math.round(v);

  const activityFactorFromChoice = (choice) => {
    switch (choice) {
      case "1": return 1.2;
      case "2": return 1.275;
      case "3-5": return 1.55;
      case "6-7": return 1.725;
      case "daily-intense": return 1.9;
      default: return 1.375;
    }
  };

  // core calculate function now shows loader, then computes results
  const calculate = () => {
    if (!gender || !age || !heightFeet || !weight || !activity || !goal) {
      alert("Please fill: gender, age, height (ft), weight, activity and goal.");
      return;
    }

    // show loader
    setLoading(true);

    // small delay to show the loader (1.6s)
    setTimeout(() => {
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

      // Maintain TDEE
      const maintain = Math.round(bmrCalc * actFactor);
      setTdee(maintain);

      // Calorie variants for loss tiers and gain logic
      const mild = Math.round(maintain * 0.9);
      const weightLoss = Math.round(maintain * 0.8);
      const extreme = Math.round(maintain * 0.61);

      // Save map
      setCaloriesMap({ maintain, mild, weight: weightLoss, extreme });

      // Protein target (1.5g/kg default, 1.8g/kg for gain)
      const proteinG = Math.round(weightKg * (goal === "gain" ? 1.8 : 1.5));
      setProtein(proteinG);

      // Macros calculation (protein prioritized)
      let proteinCalories = proteinG * 4;
      let totalCalories = maintain;
      const defaultProteinPercent = 0.25;
      const defaultProteinCals = totalCalories * defaultProteinPercent;
      let carbsCals, fatCals;

      if (proteinCalories > defaultProteinCals) {
        const remainingCals = Math.max(0, totalCalories - proteinCalories);
        carbsCals = Math.round(remainingCals * 0.66);
        fatCals = Math.round(remainingCals * 0.34);
      } else {
        proteinCalories = Math.round(totalCalories * defaultProteinPercent);
        carbsCals = Math.round(totalCalories * 0.5);
        fatCals = Math.round(totalCalories * 0.25);
        const proteinFromPercentG = Math.round(proteinCalories / 4);
        if (proteinFromPercentG < proteinG) {
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

      // generate zigzag schedules (supporting lose/gain/maintain)
      const { scheduleA, scheduleB } = generateZigzagSchedules(maintain, goal);
      setZigzagCalories(scheduleA); // show scheduleA in main table
      setDietPlan(buildDietPlanWithQuantities(
        // select dailyCaloriesForPlan similar to earlier logic
        goal === "lose"
          ? (intensity === "mild" ? mild : intensity === "moderate" ? weightLoss : extreme)
          : goal === "gain"
            ? (intensity === "mild" ? Math.round(maintain * 1.05) : intensity === "moderate" ? Math.round(maintain * 1.1) : Math.round(maintain * 1.15))
            : maintain,
        proteinG,
        dietType
      ));

      setCaloriesMap({ maintain, mild, weight: weightLoss, extreme });

      // motivational quote
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

      // hide loader
      setLoading(false);
    }, 1600);
  };

  // Zigzag schedule generator (two sample schedules)
  const generateZigzagSchedules = (maintain, goalChoice) => {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    // schedule A: weekends higher, weekdays lower
    const scheduleA = days.map((d,i) => {
      const weekendBoost = (i === 0 || i === 6) ? 1.05 : 1.0;
      if (goalChoice === "lose") {
        return {
          day: d,
          mild: Math.round(maintain * 0.9 * weekendBoost),
          moderate: Math.round(maintain * 0.85 * weekendBoost),
          extreme: Math.round(maintain * 0.8 * weekendBoost)
        };
      } else if (goalChoice === "gain") {
        return {
          day: d,
          mild: Math.round(maintain * 1.05 * weekendBoost),
          moderate: Math.round(maintain * 1.1 * weekendBoost),
          extreme: Math.round(maintain * 1.15 * weekendBoost)
        };
      } else {
        return {
          day: d,
          mild: Math.round(maintain * 1.0 * weekendBoost),
          moderate: Math.round(maintain * 1.02 * weekendBoost),
          extreme: Math.round(maintain * 1.05 * weekendBoost)
        };
      }
    });

    // schedule B for variety (ramp midweek)
    const scheduleB = days.map((d,i) => {
      if (goalChoice === "lose") {
        const mildMults = [0.9,0.86,0.86,0.86,0.86,0.86,0.9];
        const weightMults = [0.8,0.726,0.726,0.726,0.726,0.726,0.8];
        const extremeMults = [0.61,0.59,0.59,0.59,0.59,0.59,0.61];
        return { day: d, mild: Math.round(maintain * mildMults[i]), moderate: Math.round(maintain * weightMults[i]), extreme: Math.round(maintain * extremeMults[i]) };
      } else if (goalChoice === "gain") {
        const gm = [1.02,1.04,1.06,1.10,1.08,1.05,1.03];
        const gw = [1.04,1.06,1.08,1.12,1.10,1.06,1.04];
        const ge = [1.06,1.08,1.10,1.15,1.12,1.08,1.06];
        return { day: d, mild: Math.round(maintain * gm[i]), moderate: Math.round(maintain * gw[i]), extreme: Math.round(maintain * ge[i]) };
      } else {
        const mm = [1.0,1.01,1.02,1.03,1.02,1.01,1.0];
        const mw = [1.02,1.03,1.04,1.05,1.04,1.03,1.02];
        const me = [1.03,1.04,1.05,1.06,1.05,1.04,1.03];
        return { day: d, mild: Math.round(maintain * mm[i]), moderate: Math.round(maintain * mw[i]), extreme: Math.round(maintain * me[i]) };
      }
    });

    return { scheduleA, scheduleB };
  };

  // Build diet plan with quantities scaled to dailyCalories and protein target
  const buildDietPlanWithQuantities = (dailyCalories, proteinTargetG, dietTypeChoice) => {
    const preC = Math.round(dailyCalories * 0.10);
    const breakfastC = Math.round(dailyCalories * 0.25);
    const lunchC = Math.round(dailyCalories * 0.30);
    const snackC = Math.round(dailyCalories * 0.10);
    const dinnerC = Math.round(dailyCalories * 0.25);

    const scale = dailyCalories / 2000;

    // protein distribution
    const protBreakfast = Math.round(proteinTargetG * 0.2);
    const protLunch = Math.round(proteinTargetG * 0.35);
    const protSnack = Math.round(proteinTargetG * 0.1);
    const protDinner = Math.round(proteinTargetG * 0.35);

    const gramsFromProtein = (wantG, proteinPer100g) => Math.round((wantG / proteinPer100g) * 100);

    // breakfast
    let breakfastText;
    if (dietTypeChoice === "veg") {
      const oatsG = Math.round(40 * scale);
      const milkMl = Math.round(250 * scale);
      const paneerG = gramsFromProtein(protBreakfast, 18);
      breakfastText = `Breakfast (~${breakfastC} kcal): Oats ${oatsG}g + Milk ${milkMl}ml + Paneer ${paneerG}g (≈${protBreakfast}g protein) + 8–10 almonds.`;
    } else {
      const oatsG = Math.round(40 * scale);
      const milkMl = Math.round(250 * scale);
      const extraProtNeeded = Math.max(0, protBreakfast - 12); // 3 egg whites ~12g
      const chickenG = extraProtNeeded > 0 ? gramsFromProtein(extraProtNeeded, 31) : 0;
      breakfastText = `Breakfast (~${breakfastC} kcal): Oats ${oatsG}g + Milk ${milkMl}ml + 3 egg whites (~12g)${ chickenG ? ` + ${chickenG}g chicken (~${extraProtNeeded}g protein)` : "" }.`;
    }

    // lunch
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

    // snack
    const snackText = `Snack (~${snackC} kcal): Sprout salad 100g (sprouts, onion, tomato, cucumber) + 1 fruit if needed. (Protein ≈ ${protSnack}g).`;

    // dinner
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

    const preText = `Pre-workout (~${preC} kcal): 1 medium banana (~100g) or 1 slice toast with peanut butter.`;

    return [preText, breakfastText, lunchText, snackText, dinnerText];
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
    pdf.setFontSize(16);
    pdf.setTextColor(220, 170, 20);
    pdf.text("MaddyLiftz — Fitness Summary", 14, 18);
    pdf.addImage(imgData, "PNG", 0, 24, pdfWidth, pdfHeight);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    const footer = `Built by MaddyLiftz | @maddymadhuu`;
    pdf.text(footer, 14, pdfHeight + 36);
    pdf.save(`${name || "client"}_MaddyLiftz_Summary.pdf`);
  };

  // water recommendation
  const waterRecommendation = () => {
    if (!weight) return null;
    const liters = (Number(weight) * 0.04).toFixed(1);
    return `${liters} L/day (approx)`;
  };

  return (
    <div
      className={`min-vh-100 d-flex flex-column justify-content-center align-items-center p-3 text-${isDark ? "white" : "dark"}`}
      style={{
        background: isDark ? "linear-gradient(to right, #000000, #0f2027, #203a43, #2c5364)" : "linear-gradient(to right, #f8f9fa, #e0e0e0)",
        transition: "0.5s ease-in-out",
      }}
    >
      <div className={`p-4 rounded-4 shadow-lg w-100`} style={{ backgroundColor: isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.95)", maxWidth: "920px", transition: "0.4s ease" }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className={`fw-bold ${isDark ? "text-warning" : "text-primary"}`}>💪 MaddyLiftz — Fitness Planner</h2>
          <div className="d-flex align-items-center gap-2">
            <div className="small text-muted me-2">@maddymadhuu</div>
            <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={toggleTheme}>{isDark ? "🌞 Light" : "🌙 Dark"}</button>
          </div>
        </div>

        {/* Form */}
        <div className="row g-3">
          <div className="col-12 col-md-3">
            <label className="form-label">Name</label>
            <input className="form-control" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Client name"/>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label">Gender</label>
            <select className="form-select" value={gender} onChange={(e)=>setGender(e.target.value)}>
              <option value="">Select</option><option value="male">Male</option><option value="female">Female</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">Age</label>
            <input className="form-control" type="number" value={age} onChange={(e)=>setAge(e.target.value)}/>
          </div>
          <div className="col-3 col-md-2">
            <label className="form-label">Height (ft)</label>
            <input className="form-control" type="number" value={heightFeet} onChange={(e)=>setHeightFeet(e.target.value)}/>
          </div>
          <div className="col-3 col-md-2">
            <label className="form-label">In</label>
            <input className="form-control" type="number" value={heightInches} onChange={(e)=>setHeightInches(e.target.value)}/>
          </div>

          <div className="col-md-3">
            <label className="form-label">Weight (kg)</label>
            <input className="form-control" type="number" value={weight} onChange={(e)=>setWeight(e.target.value)}/>
          </div>
          <div className="col-md-3">
            <label className="form-label">Workout Frequency</label>
            <select className="form-select" value={activity} onChange={(e)=>setActivity(e.target.value)}>
              <option value="">Select</option><option value="1">Once a week</option><option value="2">Twice a week</option><option value="3-5">3–5 days/week</option><option value="6-7">6–7 days/week</option><option value="daily-intense">Daily intense</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Goal</label>
            <select className="form-select" value={goal} onChange={(e)=>setGoal(e.target.value)}>
              <option value="">Select</option><option value="maintain">Maintain</option><option value="lose">Lose Weight</option><option value="gain">Gain Weight</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Diet Type</label>
            <select className="form-select" value={dietType} onChange={(e)=>setDietType(e.target.value)}>
              <option value="">Select</option><option value="nonveg">Non-Veg</option><option value="veg">Veg</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Intensity</label>
            <select className="form-select" value={intensity} onChange={(e)=>setIntensity(e.target.value)}>
              <option value="">Select</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="extreme">Extreme</option>
            </select>
          </div>

          <div className="col-12 col-md-3 d-flex align-items-end">
            <button className={`btn btn-${isDark ? "warning" : "primary"} w-100 fw-bold glow-btn`} onClick={calculate}>
              Calculate
            </button>
          </div>
        </div>

        {/* Loader */}
        {loading && (
          <div className="d-flex align-items-center gap-3 mt-4">
            <div className="spinner-border" role="status" style={{ width: 36, height: 36 }}></div>
            <div>
              <div style={{ fontWeight: 700 }}>Calculating your personalized fitness plan</div>
              <div className="small text-muted">Crunching macros, calories & meal quantities — one sec...</div>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && caloriesMap && (
          <div ref={summaryRef} className="mt-4 p-3 rounded-3" style={{ background: isDark ? "linear-gradient(135deg,#1e3c72,#2a5298)" : "#f0f6ff" }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <h5 className={isDark ? "text-warning" : "text-primary"}>Your Summary</h5>
                <small className="text-muted">BMI • BMR • TDEE • Macros</small>
              </div>
              <div className="text-end">
                <small className="text-muted">MaddyLiftz</small>
                <div className="text-warning">@maddymadhuu</div>
              </div>
            </div>

            <div className="row text-center mb-3">
              <div className="col-6 col-md-3">
                <div className="result-card">
                  <div className="label">BMI</div>
                  <div className="value">{bmi}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="result-card">
                  <div className="label">BMR</div>
                  <div className="value">{bmr} kcal</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="result-card">
                  <div className="label">TDEE (maintain)</div>
                  <div className="value">{caloriesMap.maintain.toLocaleString()} kcal</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="result-card">
                  <div className="label">Water</div>
                  <div className="value">{waterRecommendation()}</div>
                </div>
              </div>
            </div>

            {/* Calorie breakdown */}
            <div className="mb-3">
              <h6 className={isDark ? "text-light" : ""}>Calorie Targets</h6>
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
                    <div className="stat-title">Mild</div>
                    <div className="stat-value">{caloriesMap.mild.toLocaleString()}</div>
                    <div className="small text-muted">90%</div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="stat-card">
                    <div className="stat-title">Weight</div>
                    <div className="stat-value">{caloriesMap.weight.toLocaleString()}</div>
                    <div className="small text-muted">80%</div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="stat-card">
                    <div className="stat-title">Extreme</div>
                    <div className="stat-value">{caloriesMap.extreme.toLocaleString()}</div>
                    <div className="small text-muted">61%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Zigzag table */}
            <div className="mb-3">
              <div className="mb-2"><strong>Zigzag weekly schedule</strong></div>
              <div className="table-responsive mb-2">
                <table className={`table ${isDark ? "table-dark" : "table-light"} table-striped text-center`}>
                  <thead>
                    <tr><th>Day</th><th>Mild</th><th>Moderate</th><th>Extreme</th></tr>
                  </thead>
                  <tbody>
                    {zigzagCalories.map((r,i)=>(
                      <tr key={i}>
                        <td>{r.day}</td>
                        <td>{r.mild.toLocaleString()} kcal</td>
                        <td>{r.moderate.toLocaleString()} kcal</td>
                        <td>{r.extreme.toLocaleString()} kcal</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Macros */}
            {macros && (
              <div className="mb-3">
                <h6 className={isDark ? "text-light" : ""}>Daily Macros (approx)</h6>
                <div className="d-flex gap-3 flex-wrap">
                  <div className="macro-pill"><div className="macro-label">Protein</div><div className="macro-value">{macros.protein} g</div></div>
                  <div className="macro-pill"><div className="macro-label">Carbs</div><div className="macro-value">{macros.carbs} g</div></div>
                  <div className="macro-pill"><div className="macro-label">Fat</div><div className="macro-value">{macros.fat} g</div></div>
                </div>
              </div>
            )}

            {/* Diet plan */}
            <div className="mb-2">
              <h6 className={isDark ? "text-light" : ""}>Personalized Diet Plan (quantities)</h6>
              <ul className="list-group list-group-flush text-start">
                {dietPlan.map((line,i)=>(
                  <li key={i} className={`list-group-item ${isDark ? "bg-dark text-white" : "bg-light text-dark"}`}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="text-center mt-3">
              <div className="text-muted small mb-2">Motivation</div>
              <div className="quote-box">{quote}</div>
            </div>
          </div>
        )}

        {/* Download */}
        {!loading && caloriesMap && (
          <div className="d-flex gap-2 mt-3">
            <button className={`btn btn-${isDark ? "outline-light" : "outline-dark"}`} onClick={downloadSummary}>📥 Download Report</button>
          </div>
        )}

        <div className="card-footer text-muted text-center mt-3" style={{ backgroundColor: isDark ? "#021224" : "#f8f9fa" }}>
          Built by <strong>MaddyLiftz</strong> • <span className="text-warning">@maddymadhuu</span>
        </div>
      </div>
    </div>
  );
}
