import express from "express";
import path from "path";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, initDb } from "./db/index";
import { users, projects } from "./db/schema";
import { eq, desc, and, sum, sql, count } from "drizzle-orm";

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_for_dev";

app.use(express.json());
app.use(cors());

// Ensure the specific email is admin
let adminSetupDone = false;
const setupAdmin = async () => {
    if (adminSetupDone || !db) return;
    try {
        await initDb();
        const adminEmail = 'rifkifadhilatilaqli@gmail.com';
        const existingAdmins = await db.select().from(users).where(eq(users.email, adminEmail));
        
        if (existingAdmins.length === 0) {
            const hash = await bcrypt.hash('Admin4321', 10);
            await db.insert(users).values({
                name: 'Super Admin',
                email: adminEmail,
                password_hash: hash,
                is_admin: true
            });
            console.log("Created admin user");
        } else if (!existingAdmins[0].is_admin) {
            await db.update(users).set({ is_admin: true }).where(eq(users.email, adminEmail));
            console.log("Updated admin user privileges");
        }
        adminSetupDone = true;
    } catch (e) {
        console.error("Failed to setup admin user", e);
    }
};

// --- Authentication Middleware ---
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
        res.status(403).json({ error: "Forbidden" });
        return;
    }
    (req as any).user = user;
    next();
  });
};

const checkDb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!db) {
    const keys = Object.keys(process.env).filter(k => 
      k.includes('URL') || k.includes('POSTGRES') || k.includes('DATABASE') || 
      k.includes('STORAGE') || k.includes('NEON') || k.includes('PG')
    );
    res.status(500).json({ 
      error: `Database belum terhubung. Vercel env keys yang tersedia: ${keys.join(', ')}. Pastikan Vercel Postgres/Neon sudah dibuat dan Prefix environment variables sesuai.` 
    });
    return;
  }
  next();
};

app.use('/api', checkDb);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    if (db) {
      await db.execute(sql`SELECT 1`);
      res.json({ status: 'ok', db: 'connected' });
    } else {
      res.json({ status: 'ok', db: 'not configured' });
    }
  } catch (err: any) {
    res.status(500).json({ status: 'error', db: err.message });
  }
});

// --- API Routes ---

// Register
app.post("/api/register", async (req, res) => {
  try {
    await setupAdmin();
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ error: "All fields are required." });
        return;
    }
    
    const existing = await db.select().from(users).where(eq(users.email, email));
    
    if (existing && existing.length > 0) {
        res.status(400).json({ error: "Email already exists." });
        return;
    }
    
    // Make specific user admin automatically
    let isAdmin = false;
    if (email === 'rifkifadhilatilaqli@gmail.com') {
        isAdmin = true;
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db.insert(users).values({
        name,
        email,
        password_hash: hash,
        is_admin: isAdmin
    }).returning({ id: users.id });
    
    res.json({ id: result[0].id, message: "User registered successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    await setupAdmin();
    const { email, password } = req.body;
    const records = await db.select().from(users).where(eq(users.email, email));
    
    if (records.length === 0) {
        res.status(401).json({ error: "Email atau password salah." });
        return;
    }
    const user = records[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
        res.status(401).json({ error: "Email atau password salah." });
        return;
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all projects for logged-in user
app.get("/api/projects", authenticateToken, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const list = await db.select({
        id: projects.id,
        name: projects.name,
        updated_at: projects.updated_at
    }).from(projects).where(eq(projects.user_id, userId)).orderBy(desc(projects.updated_at));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update or Create Project
app.post("/api/projects", authenticateToken, async (req, res) => {
  const userId = (req as any).user.id;
  const { id, name, student_count, subject_count, data } = req.body;

  try {
    if (id) {
        // Update existing
        const result = await db.update(projects).set({
            name,
            student_count,
            subject_count,
            data: JSON.stringify(data),
            updated_at: new Date()
        }).where(and(eq(projects.id, id), eq(projects.user_id, userId))).returning({ id: projects.id });
        
        if (result.length === 0) {
            res.status(404).json({ error: "Project not found or unauthorized." });
            return;
        }
        res.json({ message: "Project updated", id });
    } else {
        // Create new
        const result = await db.insert(projects).values({
            user_id: userId,
            name,
            student_count,
            subject_count,
            data: JSON.stringify(data)
        }).returning({ id: projects.id });
        res.json({ message: "Project created", id: result[0].id });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rename project only
app.put("/api/projects/:id", authenticateToken, async (req, res) => {
  const userId = (req as any).user.id;
  const projectId = parseInt(req.params.id);
  const { name } = req.body;
  try {
      const result = await db.update(projects).set({
          name,
          updated_at: new Date()
      }).where(and(eq(projects.id, projectId), eq(projects.user_id, userId))).returning({ id: projects.id });
      
      if (result.length === 0) {
          res.status(404).json({ error: "Project not found." });
          return;
      }
      res.json({ message: "Project renamed successfully." });
  } catch(err: any) {
      res.status(500).json({ error: err.message });
  }
});

// Get Project by ID
app.get("/api/projects/:id", authenticateToken, async (req, res) => {
  const userId = (req as any).user.id;
  const projectId = parseInt(req.params.id);
  
  try {
    const result = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.user_id, userId)));
    if (result.length === 0) {
        res.status(404).json({ error: "Project not found or unauthorized." });
        return;
    }
    const project = result[0];
    const dataObj = project.data ? JSON.parse(project.data) : null;
    res.json({ ...project, data: dataObj });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Project
app.delete("/api/projects/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).user.id;
    const projectId = parseInt(req.params.id);
    try {
        const result = await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.user_id, userId))).returning({ id: projects.id });
        if (result.length === 0) {
           res.status(404).json({ error: "Project not found." });
           return;
        }
        res.json({ message: "Project deleted." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all users and project counts
app.get("/api/admin/users", authenticateToken, async (req, res) => {
  try {
    const list = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      is_admin: users.is_admin,
      created_at: users.created_at,
      project_count: sql<number>`count(${projects.id})::int`,
      total_data_bytes: sql<number>`COALESCE(SUM(LENGTH(${projects.data})), 0)::int`
    })
    .from(users)
    .leftJoin(projects, eq(users.id, projects.user_id))
    .groupBy(users.id)
    .orderBy(desc(users.created_at));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
