import express from "express";
import path from "path";
import cors from "cors";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import cookieParser from "cookie-parser";
import { db, initDb, getDb, getPool } from "./db/index";
import { users, projects } from "./db/schema";
import { eq, desc, and, sum, sql, count } from "drizzle-orm";

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_for_dev";
const jwtSecretKey = new TextEncoder().encode(JWT_SECRET);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : true,
  credentials: true
}));

// Ensure the specific email is admin
let adminSetupDone = false;
const setupAdmin = async () => {
    const dbInstance = getDb();
    if (adminSetupDone || !dbInstance) return;
    try {
        await initDb();
        const adminEmail = 'rifkifadhilatilaqli@gmail.com';
        const existingAdmins = await dbInstance.select().from(users).where(eq(users.email, adminEmail));
        
        if (existingAdmins.length === 0) {
            const hash = await bcrypt.hash('Admin4321', 10);
            await dbInstance.insert(users).values({
                name: 'Super Admin',
                email: adminEmail,
                password: hash, // new column
                password_hash: hash, // old column
                role: 'admin',
                is_admin: true
            });
            console.log("Created admin user");
        } else if (existingAdmins[0].role !== 'admin') {
            await dbInstance.update(users).set({ role: 'admin', is_admin: true }).where(eq(users.email, adminEmail));
            console.log("Updated admin user privileges");
        }
        adminSetupDone = true;
    } catch (e) {
        console.error("Failed to setup admin user", e);
    }
};

// --- Authentication Middleware ---
const authenticateToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.token;
  
  if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecretKey);
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
};

const checkDb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const dbInstance = getDb();
  if (!dbInstance) {
    res.status(500).json({
      error: "Database tidak terhubung.",
      hint: "Periksa environment variable POSTGRES_URL di Vercel Dashboard"
    });
    return;
  }
  next();
};

app.use('/api', checkDb);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbInstance = getDb();
  const envCheck = {
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
    DATABASE_URL: !!process.env.DATABASE_URL,
  };

  if (!dbInstance) {
    res.status(500).json({
      status: 'error',
      db: 'not_configured',
      env: envCheck
    });
    return;
  }

  try {
    await dbInstance.execute(sql`SELECT 1`);
    res.json({ status: 'ok', db: 'connected', env: envCheck });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      db: err.message,
      env: envCheck
    });
  }
});

// --- API Routes ---

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    await setupAdmin();
    const dbInstance = getDb();
    if (!dbInstance) throw new Error("DB not initialized");

    const { email, password, name } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: "Email and password are required." });
        return;
    }
    
    const existing = await dbInstance.select().from(users).where(eq(users.email, email));
    
    if (existing && existing.length > 0) {
        res.status(400).json({ error: "Email already exists." });
        return;
    }
    
    let role = 'user';
    let isAdmin = false;
    if (email === 'rifkifadhilatilaqli@gmail.com') {
        role = 'admin';
        isAdmin = true;
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await dbInstance.insert(users).values({
        name: name || email.split('@')[0],
        email,
        password: hash,
        password_hash: hash,
        role,
        is_admin: isAdmin
    }).returning({ id: users.id });
    
    res.json({ success: true, id: result[0].id, message: "User registered successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    await setupAdmin();
    const dbInstance = getDb();
    if (!dbInstance) throw new Error("DB not initialized");

    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: "Email and password are required." });
        return;
    }

    const records = await dbInstance.select().from(users).where(eq(users.email, email));
    
    if (records.length === 0) {
        res.status(401).json({ error: "Email atau password salah." });
        return;
    }
    const user = records[0];
    const hashToCompare = user.password || user.password_hash;
    if (!hashToCompare) {
        res.status(401).json({ error: "Email atau password salah." });
        return;
    }

    const valid = await bcrypt.compare(password, hashToCompare);
    
    if (!valid) {
        res.status(401).json({ error: "Email atau password salah." });
        return;
    }
    
    const token = await new SignJWT({ id: user.id, email: user.email, name: user.name, role: user.role, is_admin: user.is_admin })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(jwtSecretKey);
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ success: true, role: user.role, user: { id: user.id, name: user.name, email: user.email, role: user.role, is_admin: user.is_admin } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: "Logged out successfully" });
});

// Get current user
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  res.json({ user });
});

// Get all projects for logged-in user
app.get("/api/projects", authenticateToken, async (req, res) => {
  const dbInstance = getDb();
  if (!dbInstance) return;

  const userId = (req as any).user.id;
  try {
    const list = await dbInstance.select({
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
  const dbInstance = getDb();
  if (!dbInstance) return;

  const userId = (req as any).user.id;
  const { id, name, student_count, subject_count, data } = req.body;

  try {
    if (id) {
        // Update existing
        const result = await dbInstance.update(projects).set({
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
        const result = await dbInstance.insert(projects).values({
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
  const dbInstance = getDb();
  if (!dbInstance) return;

  const userId = (req as any).user.id;
  const projectId = parseInt(req.params.id);
  const { name } = req.body;
  try {
      const result = await dbInstance.update(projects).set({
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
  const dbInstance = getDb();
  if (!dbInstance) return;

  const userId = (req as any).user.id;
  const projectId = parseInt(req.params.id);
  
  try {
    const result = await dbInstance.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.user_id, userId)));
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
    const dbInstance = getDb();
    if (!dbInstance) return;

    const userId = (req as any).user.id;
    const projectId = parseInt(req.params.id);
    try {
        const result = await dbInstance.delete(projects).where(and(eq(projects.id, projectId), eq(projects.user_id, userId))).returning({ id: projects.id });
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
  const dbInstance = getDb();
  if (!dbInstance) return;

  try {
    const list = await dbInstance.select({
      id: users.id,
      name: users.name,
      email: users.email,
      is_admin: users.is_admin,
      role: users.role,
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
