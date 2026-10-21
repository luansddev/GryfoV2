import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { collection, doc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

interface UserData {
  name: string;
  sobrenome: string;
  email: string;
  senha: string;
  cpf: string;
}

export async function checkEmailExists(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  // 1. Tentar verificação via Auth (se enumeration protection estiver desativado)
  try {
    const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
    if (methods && methods.length > 0) {
      return true;
    }
  } catch (authErr) {
    // Ignora se der erro ou restrição
  }

  // 2. Verificação no Firestore na coleção 'users'
  try {
    const q = query(
      collection(db, 'users'),
      where('email', '==', normalizedEmail),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return true;
    }

    // Se o email original continha maiúsculas, checa também o formato original (legado)
    if (email.trim() !== normalizedEmail) {
      const qOrig = query(
        collection(db, 'users'),
        where('email', '==', email.trim()),
        limit(1)
      );
      const snapOrig = await getDocs(qOrig);
      if (!snapOrig.empty) {
        return true;
      }
    }
  } catch (firestoreErr) {
    console.warn("Erro ao consultar Firestore para email:", firestoreErr);
  }

  return false;
}

export async function registerUser({ name, sobrenome, email, senha, cpf }: UserData) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, senha);
    const uid = userCredential.user.uid;

    await setDoc(doc(db, 'users', uid), {
      name,
      sobrenome,
      email: normalizedEmail,
      cpf,
      createdAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao cadastrar usuário:", error);
    let errorMsg = 'Não foi possível cadastrar o usuário.';
    if (error?.code === 'auth/email-already-in-use') {
      errorMsg = 'Este e-mail já está cadastrado.';
    } else if (error?.code === 'auth/invalid-email') {
      errorMsg = 'E-mail inválido.';
    } else if (error?.code === 'auth/weak-password') {
      errorMsg = 'A senha deve ter pelo menos 6 caracteres.';
    }
    return { success: false, error: errorMsg, code: error?.code };
  }
}
