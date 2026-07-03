from django.contrib.auth import authenticate, get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView


User = get_user_model()


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password")
        full_name = (request.data.get("full_name") or "").strip() or (request.data.get("name") or "").strip()

        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({"error": "Password is required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=email).exists():
            return Response({"error": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
        )

        # Optional full name fields (only if model has them)
        if full_name:
            if hasattr(user, "first_name"):
                user.first_name = full_name
            if hasattr(user, "full_name"):
                setattr(user, "full_name", full_name)
            user.save(update_fields=["first_name"] if hasattr(user, "first_name") else None)

        return Response({"message": "Signup successful."}, status=status.HTTP_201_CREATED)


class SigninView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password")

        if not email or not password:
            return Response({"error": "Email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=email, email=email, password=password)
        if user is None:
            return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        # For now, frontend just needs a success response.
        # Since this project doesn't yet use JWT, we return a simple flag.
        return Response({"message": "Signin successful.", "user": {"email": user.email}}, status=status.HTTP_200_OK)

