import { Router } from 'express';
import { iniciarSesionWeb, perfilWeb } from '../controllers/authWebController.js';
import { authWeb } from '../middlewares/authWeb.js';

const router = Router();

router.post('/login', iniciarSesionWeb);
router.get('/me', authWeb, perfilWeb);

export default router;
