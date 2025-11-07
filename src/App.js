import React, { useState, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function App() {
  const [name, setName] = useState("Madhu");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");
  const [dietType, setDietType] = useState("nonveg");
  const [intensity, setIntensity] = useState("moderate");

  const [bmi, setBmi] = useState(null);
  const [tdee, setTdee] = useState(null);
  const [protein, setProtein] = useState(null);
  const [zigzagCalories, setZigzagCalories] = useState([]);
  const [dietPlan, setDietPlan] = useState([]);

  const summaryRef = useRef();

  const calculate = () => {
    if (!age || !heightFeet || !weight || !activity || !goal || !gender) {
      alert("⚠️ Please fill all fields!");
      return;
    }

    const totalInches = parseFloat(heightFeet) * 12 + parseFloat(heightInches || 0);
    const heightCm = totalInches * 2.54;
    const weightKg = parseFloat(weight);
    const heightM = heightCm / 100;

    const bmiValue = (weightKg / (heightM * heightM)).toFixed(1);
    setBmi(bmiValue);

    let bmr =
      gender === "male"
        ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

    const activityFactor =
      activity === "1"
        ? 1.2
        : activity === "2"
        ? 1.35
        : activity === "3-5"
        ? 1.55
        : 1.75;

    let calories = bmr * activityFactor;

    if (goal === "lose") calories -= 500;
    else if (goal === "gain") calories += 500;

    setTdee(Math.round(calories));
    setProtein(Math.round(weightKg * 1.5));

    const zigzag = generateZigzag(calories);
    setZigzagCalories(zigzag);

    const dailyCalories = intensity === "mild"
      ? zigzag[0].mild
      : intensity === "moderate"
      ? zigzag[0].moderate
      : zigzag[0].extreme;

    setDietPlan(generateDietPlan(dailyCalories, dietType));
  };

  const generateZigzag = (baseCalories) => {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return days.map((day, i) => {
      const weekendBoost = i === 0 || i === 6 ? 1.05 : 1;
      return {
        day,
        mild: Math.round(baseCalories * 0.9 * weekendBoost),
        moderate: Math.round(baseCalories * 0.85 * weekendBoost),
        extreme: Math.round(baseCalories * 0.8 * weekendBoost)
      };
    });
  };

  const generateDietPlan = (dailyCalories, dietType) => {
    const round = (val) => Math.round(val);
    const preWorkout = round(dailyCalories * 0.1);
    const breakfast = round(dailyCalories * 0.25);
    const lunch = round(dailyCalories * 0.3);
    const snack = round(dailyCalories * 0.1);
    const dinner = round(dailyCalories * 0.25);

    return [
      `🏋️ Pre-Workout (~${preWorkout} kcal): 1 banana + water or black coffee.`,
      dietType === "veg"
        ? `🍳 Breakfast (~${breakfast} kcal): Oats 40g + Milk 250ml + Almonds 15g + Paneer 50g.`
        : `🍳 Breakfast (~${breakfast} kcal): Oats 40g + Milk 250ml + Almonds 15g + 3 egg whites.`,
      dietType === "veg"
        ? `🍛 Lunch (~${lunch} kcal): Rice 180g + Dal 100g or Paneer 100g + Mixed Veg 100g + Salad 100g.`
        : `🍗 Lunch (~${lunch} kcal): Rice 180g + Chicken 120g + Mixed Veg 100g + Salad 100g.`,
      `🥗 Snack (~${snack} kcal): 100g Sprouts salad with onion, tomato, cucumber, lemon.`,
      dietType === "veg"
        ? `🌙 Dinner (~${dinner} kcal): 2 Chapatis or Rice 150g + Tofu/Paneer 100g + Veggies 100g + Salad 100g.`
        : `🌙 Dinner (~${dinner} kcal): 2 Chapatis or Rice 150g + Chicken/Fish 100g + Veggies 100g + Salad 100g.`
    ];
  };

  const downloadSummary = async () => {
    if (!summaryRef.current) return;
    const canvas = await html2canvas(summaryRef.current, { scale: 3 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const imgProps = pdf.getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Fitness_Summary.pdf`);
  };

  return (
    <div className="min-vh-100 d-flex flex-column justify-content-center align-items-center p-4 text-white"
      style={{ backgroundImage:"linear-gradient(to right, #0f2027, #203a43, #2c5364)", backgroundSize:"cover", backgroundPosition:"center" }}
    >
      <div className="p-4 rounded-4 shadow-lg" style={{ backgroundColor:"rgba(0,0,0,0.75)", width:"95%", maxWidth:"700px" }}>
        <h2 className="text-center mb-4 fw-bold text-warning">💪 Fitness & Nutrition Planner</h2>
        <p className="text-center text-light mb-3">Instagram/Twitter: <a href="https://instagram.com/maddymadhuu" className="text-warning">@maddymadhuu</a></p>

        <div className="row g-3">
          <div className="col-md-6">
            <label>Name</label>
            <input type="text" className="form-control" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your Name"/>
          </div>
          <div className="col-md-6">
            <label>Gender</label>
            <select className="form-select" value={gender} onChange={(e)=>setGender(e.target.value)}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="col-md-6">
            <label>Age</label>
            <input type="number" className="form-control" value={age} onChange={(e)=>setAge(e.target.value)}/>
          </div>
          <div className="col-md-6">
            <label>Height (Feet & Inches)</label>
            <div className="d-flex gap-2">
              <input type="number" placeholder="Feet" className="form-control" value={heightFeet} onChange={(e)=>setHeightFeet(e.target.value)}/>
              <input type="number" placeholder="Inches" className="form-control" value={heightInches} onChange={(e)=>setHeightInches(e.target.value)}/>
            </div>
          </div>
          <div className="col-md-6">
            <label>Weight (kg)</label>
            <input type="number" className="form-control" value={weight} onChange={(e)=>setWeight(e.target.value)}/>
          </div>
          <div className="col-md-6">
            <label>Workout Frequency</label>
            <select className="form-select" value={activity} onChange={(e)=>setActivity(e.target.value)}>
              <option value="">Select</option>
              <option value="1">Once a week</option>
              <option value="2">Twice a week</option>
              <option value="3-5">3–5 days/week</option>
              <option value="7">7 days/week</option>
            </select>
          </div>
          <div className="col-md-6">
            <label>Goal</label>
            <select className="form-select" value={goal} onChange={(e)=>setGoal(e.target.value)}>
              <option value="">Select</option>
              <option value="lose">Lose Weight</option>
              <option value="gain">Gain Weight</option>
              <option value="maintain">Maintain</option>
            </select>
          </div>
          <div className="col-md-6">
            <label>Diet Type</label>
            <select className="form-select" value={dietType} onChange={(e)=>setDietType(e.target.value)}>
              <option value="nonveg">Non-Vegetarian</option>
              <option value="veg">Vegetarian</option>
            </select>
          </div>
          <div className="col-md-6">
            <label>Intensity</label>
            <select className="form-select" value={intensity} onChange={(e)=>setIntensity(e.target.value)}>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="extreme">Extreme</option>
            </select>
          </div>
        </div>

        <div className="text-center mt-4">
          <button className="btn btn-warning fw-bold px-5 py-2 rounded-pill" onClick={calculate}>Calculate</button>
        </div>

        {bmi && (
          <div ref={summaryRef} className="mt-4 p-4 rounded-3" style={{ background:"linear-gradient(135deg, #1e3c72, #2a5298)", color:"#fff" }}>
            <h3 className="text-center mb-3">🎉 Hey {name || "there"}! Here's your Fitness Summary</h3>
            <div className="d-flex justify-content-around text-center mb-4">
              <div>
                <h5>💪 BMI</h5>
                <p>{bmi}</p>
              </div>
              <div>
                <h5>🔥 Calories</h5>
                <p>{tdee} kcal/day</p>
              </div>
              <div>
                <h5>🥩 Protein</h5>
                <p>{protein} g/day</p>
              </div>
            </div>

            <h5 className="text-center mb-2">Weekly Calorie Table</h5>
            <div className="table-responsive mb-3">
              <table className="table table-dark table-striped text-center">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Mild</th>
                    <th>Moderate</th>
                    <th>Extreme</th>
                  </tr>
                </thead>
                <tbody>
                  {zigzagCalories.map((item, i)=>(
                    <tr key={i}>
                      <td>{item.day}</td>
                      <td>{item.mild} kcal</td>
                      <td>{item.moderate} kcal</td>
                      <td>{item.extreme} kcal</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h5 className="text-center mb-2">🥗 Diet Plan ({intensity})</h5>
            <ul className="list-group list-group-flush text-start">
              {dietPlan.map((meal, i) => (
                <li key={i} className="list-group-item bg-dark text-white">{meal}</li>
              ))}
            </ul>

            <p className="text-center mt-3">Instagram/Twitter: <span className="text-warning">@maddymadhuu</span></p>
          </div>
        )}

        {bmi && (
          <div className="text-center mt-3">
            <button className="btn btn-success fw-bold px-5 py-2 rounded-pill" onClick={downloadSummary}>📥 Download Premium Report</button>
          </div>
        )}
      </div>
    </div>
  );
}
